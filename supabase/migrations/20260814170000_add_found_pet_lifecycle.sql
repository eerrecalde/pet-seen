-- PS-406: found-pet reports are private operational records.  They expire when
-- no owner connection is made, can be deliberately reopened by staff, and are
-- purged by the housekeeping function after the one-year retention period.

create type public.found_pet_lifecycle_status as enum ('active', 'resolved', 'expired');

alter table public.found_pet_reports
  add column lifecycle_status public.found_pet_lifecycle_status not null default 'active',
  add column lifecycle_reason text check (lifecycle_reason is null or char_length(trim(lifecycle_reason)) between 1 and 80),
  add column lifecycle_changed_at timestamptz not null default now();

create index found_pet_reports_lifecycle_changed_idx
  on public.found_pet_reports (lifecycle_status, lifecycle_changed_at asc);

alter table public.found_pet_report_moderation_audit
  drop constraint found_pet_report_moderation_audit_event_check,
  add constraint found_pet_report_moderation_audit_event_check check (event in (
    'submitted_for_review', 'approved', 'rejected', 'rejected_files_deleted',
    'automatically_approved', 'automatically_rejected',
    'photo_processing_started', 'photo_processing_completed', 'photo_processing_failed',
    'resolved', 'expired', 'reopened', 'deleted', 'deleted_files_deleted',
    'retention_deleted', 'retention_files_deleted'
  ));

-- A linked, confirmed report is part of an active recovery conversation and is
-- never silently expired.  Reopening is staff-only and preserves the original
-- report rather than creating a duplicate.
create function public.set_found_pet_report_lifecycle(
  target_report_id uuid,
  next_status public.found_pet_lifecycle_status,
  reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare current_status public.found_pet_lifecycle_status;
begin
  if not public.is_authorized_staff() then
    raise exception 'Only Pet Seen staff can manage found-pet reports';
  end if;
  if next_status = 'active' and nullif(trim(reason), '') is not null then
    raise exception 'A reopened report cannot have a closure reason';
  end if;
  if next_status <> 'active' and nullif(trim(reason), '') is null then
    raise exception 'Choose a reason for this lifecycle action';
  end if;

  select lifecycle_status into current_status from public.found_pet_reports where id = target_report_id for update;
  if current_status is null then raise exception 'Found-pet report not found'; end if;
  if current_status = next_status then raise exception 'This report already has that status'; end if;
  if next_status = 'expired' and exists (
    select 1 from public.found_pet_case_links where found_pet_report_id = target_report_id and status = 'confirmed'
  ) then raise exception 'A confirmed owner connection cannot be expired'; end if;

  update public.found_pet_reports
  set lifecycle_status = next_status,
      lifecycle_reason = case when next_status = 'active' then null else trim(reason) end,
      lifecycle_changed_at = now()
  where id = target_report_id;

  insert into public.found_pet_report_moderation_audit (found_pet_report_id, event, actor_id, metadata)
  values (target_report_id,
    case next_status when 'active' then 'reopened' when 'resolved' then 'resolved' else 'expired' end,
    auth.uid(),
    case when next_status = 'active' then '{}'::jsonb else jsonb_build_object('reason', trim(reason)) end
  );
end;
$$;

-- Called by the scheduled housekeeping function.  Thirty days gives a pending
-- report enough time for screening and an approved report enough time for a
-- conservative match, without keeping an unlinked exact location indefinitely.
create function public.expire_stale_found_pet_reports()
returns integer
language plpgsql security definer set search_path = public as $$
declare changed_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_authorized_staff() then
    raise exception 'Only Pet Seen housekeeping can expire found-pet reports';
  end if;
  with expired as (
    update public.found_pet_reports r
    set lifecycle_status = 'expired', lifecycle_reason = 'stale_unlinked', lifecycle_changed_at = now()
    where r.lifecycle_status = 'active'
      and r.found_at < now() - interval '30 days'
      and not exists (
        select 1 from public.found_pet_case_links l
        where l.found_pet_report_id = r.id and l.status = 'confirmed'
      )
    returning r.id
  )
  insert into public.found_pet_report_moderation_audit (found_pet_report_id, event, metadata)
  select id, 'expired', jsonb_build_object('reason', 'stale_unlinked', 'automatic', true) from expired;
  get diagnostics changed_count = row_count;
  return changed_count;
end;
$$;

-- The caller removes object storage first, then deletes each returned report.
-- Keeping this list in the database makes the retention boundary reviewable
-- without putting file paths or submitted content into the audit trail.
create function public.found_pet_reports_due_for_retention_cleanup()
returns table (report_id uuid, source_object_path text, display_object_path text)
language sql security definer set search_path = public as $$
  select r.id, p.source_object_path, p.display_object_path
  from public.found_pet_reports r
  left join public.found_pet_photos p on p.found_pet_report_id = r.id
  where r.lifecycle_status in ('resolved', 'expired')
    and r.lifecycle_changed_at < now() - interval '1 year'
    and (coalesce(auth.role(), '') = 'service_role' or public.is_authorized_staff());
$$;

-- Lifecycle state is an additional access boundary for private owner/reporter
-- reads: expired and resolved reports remain staff-only until retention purge.
drop policy "Matched owners can read approved found-pet reports" on public.found_pet_reports;
create policy "Matched owners can read active approved found-pet reports"
  on public.found_pet_reports for select to authenticated using (
    lifecycle_status = 'active' and moderation_status = 'approved' and exists (
      select 1 from public.found_pet_case_links l join public.missing_cases c on c.id = l.case_id
      where l.found_pet_report_id = found_pet_reports.id and l.status in ('pending_owner', 'confirmed') and c.owner_id = auth.uid()
    )
  );

drop policy "Reporter can read their found pet reports" on public.found_pet_reports;
create policy "Reporter can read active found pet reports"
  on public.found_pet_reports for select to authenticated
  using (lifecycle_status = 'active' and reporter_id = auth.uid());

create or replace function public.can_access_found_pet_conversation(target_report_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.found_pet_reports r
    join public.found_pet_case_links l on l.found_pet_report_id = r.id and l.status = 'confirmed'
    join public.missing_cases c on c.id = l.case_id
    where r.id = target_report_id and r.lifecycle_status = 'active'
      and r.reporter_id is not null
      and (r.reporter_id = auth.uid() or c.owner_id = auth.uid())
  );
$$;

revoke all on function public.set_found_pet_report_lifecycle(uuid, public.found_pet_lifecycle_status, text), public.expire_stale_found_pet_reports(), public.found_pet_reports_due_for_retention_cleanup() from public;
grant execute on function public.set_found_pet_report_lifecycle(uuid, public.found_pet_lifecycle_status, text) to authenticated;
grant execute on function public.expire_stale_found_pet_reports(), public.found_pet_reports_due_for_retention_cleanup() to service_role;
