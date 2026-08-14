-- PS-403: approved reports may create one conservative, provisional owner match.

create type public.found_pet_match_status as enum ('pending_owner', 'confirmed', 'declined');

alter table public.found_pet_case_links
  drop constraint found_pet_case_links_pkey,
  add column status public.found_pet_match_status not null default 'pending_owner',
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references auth.users (id) on delete set null,
  alter column linked_by drop not null,
  add primary key (found_pet_report_id, case_id),
  add constraint found_pet_case_links_review_check check (
    (status = 'pending_owner' and reviewed_at is null and reviewed_by is null)
    or (status in ('confirmed', 'declined') and reviewed_at is not null and reviewed_by is not null)
  );

drop policy "Linked owners can read approved found-pet reports" on public.found_pet_reports;
create policy "Matched owners can read their found-pet links" on public.found_pet_case_links for select to authenticated using (
  status in ('pending_owner', 'confirmed') and exists (select 1 from public.missing_cases c where c.id = case_id and c.owner_id = auth.uid())
);
create policy "Matched owners can read approved found-pet reports" on public.found_pet_reports for select to authenticated using (
  moderation_status = 'approved' and exists (
    select 1 from public.found_pet_case_links l join public.missing_cases c on c.id = l.case_id
    where l.found_pet_report_id = found_pet_reports.id and l.status in ('pending_owner', 'confirmed') and c.owner_id = auth.uid()
  )
);

create function public.create_provisional_found_pet_match(target_report_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare best record; runner_up smallint;
begin
  select * into best from public.found_pet_case_candidates(target_report_id) limit 1;
  if best.case_id is null or best.match_score < 95 then return false; end if;
  select match_score into runner_up from public.found_pet_case_candidates(target_report_id) offset 1 limit 1;
  if runner_up is not null and best.match_score - runner_up < 10 then return false; end if;
  insert into public.found_pet_case_links (found_pet_report_id, case_id, match_score, match_reasons)
  values (target_report_id, best.case_id, best.match_score, best.match_reasons)
  on conflict (found_pet_report_id, case_id) do nothing;
  return found;
end;
$$;

create or replace function public.review_found_pet_report(target_report_id uuid, decision public.found_pet_moderation_status)
returns void language plpgsql security definer set search_path = public as $$
begin
  if decision not in ('approved', 'rejected') or not public.is_authorized_staff() then raise exception 'Only Pet Seen staff can moderate found-pet reports'; end if;
  update public.found_pet_reports set moderation_status = decision, moderated_at = now(), moderated_by = auth.uid() where id = target_report_id and moderation_status = 'pending';
  if not found then raise exception 'This report is no longer awaiting review'; end if;
  insert into public.found_pet_report_moderation_audit (found_pet_report_id, event, actor_id) values (target_report_id, decision::text, auth.uid());
  if decision = 'approved' then perform public.create_provisional_found_pet_match(target_report_id); end if;
end;
$$;

create function public.review_found_pet_match(target_report_id uuid, target_case_id uuid, decision public.found_pet_match_status)
returns void language plpgsql security definer set search_path = public as $$
begin
  if decision not in ('confirmed', 'declined') then raise exception 'Choose confirm or decline'; end if;
  update public.found_pet_case_links l set status = decision, reviewed_at = now(), reviewed_by = auth.uid()
  where l.found_pet_report_id = target_report_id and l.case_id = target_case_id and l.status = 'pending_owner'
    and exists (select 1 from public.missing_cases c where c.id = l.case_id and c.owner_id = auth.uid());
  if not found then raise exception 'Match not found or you cannot review it'; end if;
end;
$$;

revoke all on function public.create_provisional_found_pet_match(uuid), public.review_found_pet_match(uuid, uuid, public.found_pet_match_status) from public;
grant execute on function public.review_found_pet_match(uuid, uuid, public.found_pet_match_status) to authenticated;
grant select on public.found_pet_case_links, public.found_pet_reports, public.found_pet_photos to authenticated;
