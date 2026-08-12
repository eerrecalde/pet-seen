-- PS-204–206: linked sighting emails, owner review states and reunion outcomes.

create type public.sighting_report_status as enum ('pending', 'confirmed', 'dismissed');
create type public.reunion_reason as enum ('returned_home', 'found_by_neighbour', 'seen_after_report', 'other');
create type public.owner_email_notification_status as enum ('pending', 'sent', 'failed');

alter table public.sightings
  add column report_status public.sighting_report_status not null default 'pending',
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references auth.users (id) on delete set null,
  add constraint sightings_review_state_check check (
    (report_status = 'pending' and reviewed_at is null and reviewed_by is null)
    or (report_status <> 'pending' and reviewed_at is not null and reviewed_by is not null)
  );

alter table public.missing_cases
  add column reunion_reason public.reunion_reason,
  add column reunion_pet_seen_attributed boolean;

-- Preserve records closed before outcomes were collected. Future reunions
-- must supply both fields under the constraint below.
update public.missing_cases
set reunion_reason = 'other', reunion_pet_seen_attributed = false
where status = 'reunited';

alter table public.missing_cases
  add constraint missing_cases_reunion_details_check check (
    (status <> 'reunited' and reunion_reason is null and reunion_pet_seen_attributed is null)
    or (status = 'reunited' and reunion_reason is not null and reunion_pet_seen_attributed is not null)
  );

create table public.owner_email_notifications (
  id uuid primary key default gen_random_uuid(),
  sighting_id uuid not null unique references public.sightings (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  status public.owner_email_notification_status not null default 'pending',
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint owner_email_notifications_delivery_check check (
    (status = 'sent' and sent_at is not null and last_error is null)
    or (status <> 'sent' and sent_at is null)
  )
);

create index sightings_case_report_status_idx on public.sightings (case_id, report_status, seen_at desc);
create index owner_email_notifications_status_created_at_idx on public.owner_email_notifications (status, created_at);

create or replace view public.owner_case_sightings
with (security_invoker = true)
as
  select
    id, case_id, seen_at, location_description, details, created_at,
    extensions.st_y(exact_location) as latitude,
    extensions.st_x(exact_location) as longitude,
    report_status
  from public.sightings;

create trigger owner_email_notifications_set_updated_at
  before update on public.owner_email_notifications
  for each row execute procedure public.set_record_updated_at();

create function public.queue_linked_sighting_owner_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.case_id is not null then
    insert into public.owner_email_notifications (sighting_id, recipient_id)
    select new.id, owner_id from public.missing_cases where id = new.case_id;
  end if;
  return new;
end;
$$;

create trigger sightings_queue_linked_owner_email
  after insert on public.sightings
  for each row execute procedure public.queue_linked_sighting_owner_email();

create function public.review_sighting(
  target_sighting_id uuid,
  next_status public.sighting_report_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if next_status = 'pending' then
    raise exception 'A reviewed sighting cannot be returned to pending';
  end if;

  update public.sightings s
  set report_status = next_status, reviewed_at = now(), reviewed_by = auth.uid()
  where s.id = target_sighting_id
    and exists (
      select 1 from public.missing_cases c
      where c.id = s.case_id and c.owner_id = auth.uid()
    );

  if not found then
    raise exception 'Sighting not found or you cannot review it';
  end if;
end;
$$;

revoke all on table public.owner_email_notifications from public;
revoke all on function public.queue_linked_sighting_owner_email() from public;
revoke all on function public.review_sighting(uuid, public.sighting_report_status) from public;
grant execute on function public.review_sighting(uuid, public.sighting_report_status) to authenticated;
