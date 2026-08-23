-- PS-408: queue a privacy-safe owner email whenever staff or automation creates
-- a provisional found-pet match. Outbox aggregate IDs now also support private
-- notification records, not just sighting IDs.

alter table public.workflow_outbox
  drop constraint workflow_outbox_aggregate_id_fkey;

create table public.owner_found_pet_match_notifications (
  id uuid primary key default gen_random_uuid(),
  found_pet_report_id uuid not null,
  case_id uuid not null,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  status public.owner_email_notification_status not null default 'pending',
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (found_pet_report_id, case_id),
  foreign key (case_id) references public.missing_cases (id) on delete restrict,
  foreign key (found_pet_report_id, case_id)
    references public.found_pet_case_links (found_pet_report_id, case_id)
    on delete cascade,
  constraint owner_found_pet_match_notifications_delivery_check check (
    (status = 'sent' and sent_at is not null and last_error is null)
    or (status <> 'sent' and sent_at is null)
  )
);

create index owner_found_pet_match_notifications_status_created_idx
  on public.owner_found_pet_match_notifications (status, created_at);

alter table public.owner_found_pet_match_notifications enable row level security;
revoke all on public.owner_found_pet_match_notifications from public;

create trigger owner_found_pet_match_notifications_set_updated_at
  before update on public.owner_found_pet_match_notifications
  for each row execute procedure public.set_record_updated_at();

create function public.queue_found_pet_match_owner_email()
returns trigger language plpgsql security definer set search_path = public as $$
declare notification_id uuid;
begin
  if new.status <> 'pending_owner' then return new; end if;

  insert into public.owner_found_pet_match_notifications (
    found_pet_report_id, case_id, recipient_id
  )
  select new.found_pet_report_id, new.case_id, c.owner_id
  from public.missing_cases c
  where c.id = new.case_id
  on conflict (found_pet_report_id, case_id) do nothing
  returning id into notification_id;

  if notification_id is not null then
    insert into public.workflow_outbox (kind, aggregate_id)
    values ('owner_found_pet_match_email', notification_id)
    on conflict (kind, aggregate_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger found_pet_case_links_queue_owner_email
  after insert on public.found_pet_case_links
  for each row execute procedure public.queue_found_pet_match_owner_email();

insert into public.owner_found_pet_match_notifications (
  found_pet_report_id, case_id, recipient_id
)
select l.found_pet_report_id, l.case_id, c.owner_id
from public.found_pet_case_links l
join public.missing_cases c on c.id = l.case_id
where l.status = 'pending_owner'
on conflict (found_pet_report_id, case_id) do nothing;

insert into public.workflow_outbox (kind, aggregate_id)
select 'owner_found_pet_match_email', n.id
from public.owner_found_pet_match_notifications n
where n.status = 'pending'
on conflict (kind, aggregate_id) do nothing;

revoke all on function public.queue_found_pet_match_owner_email() from public;
