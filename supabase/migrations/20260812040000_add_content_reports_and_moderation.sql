-- PS-109: Public reports are accepted through a narrow RPC so anonymous
-- visitors can flag a published case without getting direct table access.

create type public.content_report_reason as enum ('incorrect', 'harmful', 'scam', 'other');
create type public.content_report_status as enum ('open', 'reviewed', 'dismissed', 'actioned');

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.missing_cases (id) on delete cascade,
  reporter_id uuid references auth.users (id) on delete set null,
  reason public.content_report_reason not null,
  details text check (char_length(trim(details)) between 1 and 1000),
  status public.content_report_status not null default 'open',
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_reports_review_state_check check (
    (status = 'open' and reviewed_at is null and reviewed_by is null)
    or (status <> 'open' and reviewed_at is not null and reviewed_by is not null)
  )
);

create index content_reports_status_created_at_idx
  on public.content_reports (status, created_at desc);
create index content_reports_case_id_idx on public.content_reports (case_id);

create trigger content_reports_set_updated_at
  before update on public.content_reports
  for each row execute procedure public.set_record_updated_at();

alter table public.content_reports enable row level security;
revoke all on table public.content_reports from public;
grant select, update on table public.content_reports to authenticated;

create policy "Staff can read content reports"
  on public.content_reports for select to authenticated
  using ((select public.is_authorized_staff()));

create policy "Staff can update content reports"
  on public.content_reports for update to authenticated
  using ((select public.is_authorized_staff()))
  with check ((select public.is_authorized_staff()));

create function public.submit_content_report(
  case_slug text,
  report_reason public.content_report_reason,
  report_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_case_id uuid;
  new_report_id uuid;
begin
  select case_id into target_case_id
  from public.public_missing_cases
  where public_slug = case_slug;

  if target_case_id is null then
    raise exception 'This case is no longer available';
  end if;

  insert into public.content_reports (case_id, reporter_id, reason, details)
  values (
    target_case_id,
    auth.uid(),
    report_reason,
    nullif(trim(report_details), '')
  )
  returning id into new_report_id;

  return new_report_id;
end;
$$;

create function public.set_content_report_reviewed_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'open' then
    new.reviewed_at = null;
    new.reviewed_by = null;
  elsif old.status is distinct from new.status then
    new.reviewed_at = now();
    new.reviewed_by = auth.uid();
  end if;
  return new;
end;
$$;

create trigger content_reports_set_review_details
  before update of status on public.content_reports
  for each row execute procedure public.set_content_report_reviewed_at();

revoke all on function public.submit_content_report(text, public.content_report_reason, text) from public;
grant execute on function public.submit_content_report(text, public.content_report_reason, text) to anon, authenticated;
revoke all on function public.set_content_report_reviewed_at() from public;
