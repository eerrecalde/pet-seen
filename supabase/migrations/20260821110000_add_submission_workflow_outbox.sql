-- PS-419: submissions must survive after the browser has received its receipt.
-- The outbox is the durable hand-off between the transaction that creates a
-- sighting and the separate, fallible notification providers.
do $$ begin
  create type public.workflow_outbox_status as enum ('pending', 'processing', 'delivered', 'failed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.workflow_outbox_kind as enum ('owner_sighting_email', 'watch_sighting_alert');
exception when duplicate_object then null;
end $$;

create table if not exists public.workflow_outbox (
  id uuid primary key default gen_random_uuid(),
  kind public.workflow_outbox_kind not null,
  aggregate_id uuid not null references public.sightings (id) on delete cascade,
  status public.workflow_outbox_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, aggregate_id),
  constraint workflow_outbox_delivery_state check (
    (status = 'delivered' and delivered_at is not null)
    or (status <> 'delivered' and delivered_at is null)
  )
);

create index if not exists workflow_outbox_ready_idx on public.workflow_outbox (status, available_at, created_at);
alter table public.workflow_outbox enable row level security;
revoke all on table public.workflow_outbox from public;
drop trigger if exists workflow_outbox_set_updated_at on public.workflow_outbox;
create trigger workflow_outbox_set_updated_at before update on public.workflow_outbox
  for each row execute procedure public.set_record_updated_at();

create function public.queue_sighting_workflow_outbox()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.case_id is not null then
    insert into public.workflow_outbox (kind, aggregate_id) values ('owner_sighting_email', new.id)
    on conflict (kind, aggregate_id) do nothing;
  end if;
  if exists (select 1 from public.watch_notifications where sighting_id = new.id) then
    insert into public.workflow_outbox (kind, aggregate_id) values ('watch_sighting_alert', new.id)
    on conflict (kind, aggregate_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists sightings_queue_workflow_outbox on public.sightings;
create trigger sightings_queue_workflow_outbox
  after insert on public.sightings for each row execute procedure public.queue_sighting_workflow_outbox();

revoke all on function public.queue_sighting_workflow_outbox() from public;

-- Claiming is atomic so independently triggered workers cannot send the same
-- notification twice. A stale lock is made available again for retry.
create function public.claim_workflow_outbox(target_limit integer default 20)
returns table (id uuid, kind public.workflow_outbox_kind, aggregate_id uuid, attempts integer)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with candidates as (
    select o.id from public.workflow_outbox o
    where (o.status in ('pending', 'failed') and o.available_at <= now())
       or (o.status = 'processing' and o.locked_at < now() - interval '10 minutes')
    order by o.available_at, o.created_at
    for update skip locked limit greatest(1, least(target_limit, 100))
  )
  update public.workflow_outbox o
  set status = 'processing', locked_at = now(), attempts = o.attempts + 1, last_error = null
  from candidates c where o.id = c.id
  returning o.id, o.kind, o.aggregate_id, o.attempts;
end;
$$;

create function public.complete_workflow_outbox(target_id uuid, succeeded boolean, failure_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.workflow_outbox
  set status = case when succeeded then 'delivered' else 'failed' end,
      delivered_at = case when succeeded then now() else null end,
      available_at = case when succeeded then available_at else now() + (least(60, power(2, attempts))::text || ' minutes')::interval end,
      locked_at = null,
      last_error = case when succeeded then null else left(coalesce(failure_reason, 'Delivery failed.'), 500) end
  where id = target_id and status = 'processing';
end;
$$;

revoke all on function public.claim_workflow_outbox(integer), public.complete_workflow_outbox(uuid, boolean, text) from public;
