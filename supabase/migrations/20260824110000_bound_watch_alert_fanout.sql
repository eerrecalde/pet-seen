-- PS-425: keep a busy location report bounded, quiet and recoverable.
-- A sighting can alert at most 100 distinct people. Each person can save at
-- most 10 areas and at most 3 browser subscriptions, so one delivery attempt
-- can make no more than 400 provider calls (three push attempts and one email
-- fallback per recipient). Provider failures retry at most six times.

create or replace function public.enforce_watch_area_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text, 0));
  if (select count(*) from public.watch_areas where owner_id = new.owner_id) >= 10 then
    raise exception 'You can save up to 10 watch areas';
  end if;
  return new;
end;
$$;

drop trigger if exists watch_areas_enforce_owner_limit on public.watch_areas;
create trigger watch_areas_enforce_owner_limit before insert on public.watch_areas
  for each row execute procedure public.enforce_watch_area_limit();

create or replace function public.enforce_push_subscription_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text, 1));
  if (select count(*) from public.push_subscriptions where owner_id = new.owner_id) >= 3 then
    raise exception 'You can register up to 3 browsers for watch alerts';
  end if;
  return new;
end;
$$;

drop trigger if exists push_subscriptions_enforce_owner_limit on public.push_subscriptions;
create trigger push_subscriptions_enforce_owner_limit before insert on public.push_subscriptions
  for each row execute procedure public.enforce_push_subscription_limit();

-- Old rows were per area. Keep one deterministic representative row for each
-- person and sighting before making the recipient the delivery unit.
delete from public.watch_notifications duplicate
using public.watch_notifications kept
where duplicate.sighting_id = kept.sighting_id
  and duplicate.recipient_id = kept.recipient_id
  and duplicate.id > kept.id;

alter table public.watch_notifications
  drop constraint if exists watch_notifications_watch_area_id_sighting_id_key;
alter table public.watch_notifications
  add constraint watch_notifications_sighting_recipient_key unique (sighting_id, recipient_id);
create index if not exists watch_notifications_recipient_delivery_idx
  on public.watch_notifications (recipient_id, delivered_at desc)
  where delivered_at is not null;

create or replace function public.queue_watch_area_notifications()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into public.watch_notifications (watch_area_id, sighting_id, recipient_id)
  select distinct on (area.owner_id) area.id, new.id, area.owner_id
  from public.watch_areas area
  where extensions.st_dwithin(area.centre::extensions.geography, new.exact_location::extensions.geography, area.radius_metres)
  order by area.owner_id, area.created_at, area.id
  limit 100
  on conflict (sighting_id, recipient_id) do nothing;
  return new;
end;
$$;

-- A failed provider call remains recoverable, but it cannot create an endless
-- provider bill. Quiet-period deferrals use a separate transition and do not
-- consume an attempt.
create or replace function public.claim_workflow_outbox(target_limit integer default 20)
returns table (id uuid, kind public.workflow_outbox_kind, aggregate_id uuid, attempts integer)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with candidates as (
    select o.id from public.workflow_outbox o
    where ((o.status in ('pending', 'failed') and o.available_at <= now() and o.attempts < 6)
       or (o.status = 'processing' and o.locked_at < now() - interval '10 minutes' and o.attempts < 6))
    order by o.available_at, o.created_at
    for update skip locked limit greatest(1, least(target_limit, 100))
  )
  update public.workflow_outbox o
  set status = 'processing', locked_at = now(), attempts = o.attempts + 1, last_error = null
  from candidates c where o.id = c.id
  returning o.id, o.kind, o.aggregate_id, o.attempts;
end;
$$;

create or replace function public.defer_workflow_outbox(target_id uuid, delay_minutes integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.workflow_outbox
  set status = 'pending', locked_at = null,
      attempts = greatest(0, attempts - 1),
      available_at = now() + (greatest(1, least(delay_minutes, 1440))::text || ' minutes')::interval,
      last_error = 'Watch-alert quiet period'
  where id = target_id and status = 'processing';
end;
$$;

create or replace function public.complete_workflow_outbox(target_id uuid, succeeded boolean, failure_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.workflow_outbox
  set status = case when succeeded then 'delivered'::public.workflow_outbox_status else 'failed'::public.workflow_outbox_status end,
      delivered_at = case when succeeded then now() else null end,
      available_at = case when succeeded then available_at else now() + (least(60, power(2, attempts))::text || ' minutes')::interval end,
      locked_at = null,
      last_error = case when succeeded then null else left(coalesce(failure_reason, 'Delivery failed.'), 500) end
  where id = target_id and status = 'processing'::public.workflow_outbox_status;
end;
$$;

revoke all on function public.enforce_watch_area_limit(), public.enforce_push_subscription_limit(), public.defer_workflow_outbox(uuid, integer) from public;
grant execute on function public.defer_workflow_outbox(uuid, integer) to service_role;
