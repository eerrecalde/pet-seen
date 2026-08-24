-- PS-425 regression contract for bounded, coalesced watch-alert fan-out.
-- Run locally with:
-- docker exec -i supabase_db_pet-seen psql -U postgres -d postgres < tests/sql/ps425_watch_alert_controls.sql
begin;

do $$
declare
  v_owner_id uuid := gen_random_uuid();
  v_second_owner_id uuid := gen_random_uuid();
  v_sighting_id uuid := gen_random_uuid();
  i integer;
  claimed record;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (v_owner_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ps425-owner@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (v_second_owner_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ps425-second@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

  -- Ten areas are permitted; the eleventh is rejected.
  for i in 1..10 loop
    insert into public.watch_areas (owner_id, label, centre, radius_metres)
    values (v_owner_id, 'PS-425 area ' || i, extensions.st_setsrid(extensions.st_makepoint(-0.1, 51.5), 4326), 1000);
  end loop;
  begin
    insert into public.watch_areas (owner_id, label, centre, radius_metres)
    values (v_owner_id, 'Too many', extensions.st_setsrid(extensions.st_makepoint(-0.1, 51.5), 4326), 1000);
    raise exception 'PS-425 allowed an eleventh watch area';
  exception when others then
    if position('up to 10 watch areas' in sqlerrm) = 0 then raise; end if;
  end;

  -- Overlapping areas belonging to one person yield exactly one recipient row.
  if position('limit 100' in lower(pg_get_functiondef('public.queue_watch_area_notifications()'::regprocedure))) = 0 then
    raise exception 'PS-425 recipient ceiling is missing';
  end if;
  insert into public.sightings (id, exact_location, seen_at, details)
  values (v_sighting_id, extensions.st_setsrid(extensions.st_makepoint(-0.1, 51.5), 4326), now(), 'PS-425 coalescing test');
  if (select count(*) from public.watch_notifications where sighting_id = v_sighting_id and recipient_id = v_owner_id) <> 1 then
    raise exception 'PS-425 did not coalesce overlapping areas';
  end if;

  -- A watch alert is durably claimable after a failure, but only six provider attempts are allowed.
  insert into public.workflow_outbox (kind, aggregate_id) values ('watch_sighting_alert', v_sighting_id)
  on conflict (kind, aggregate_id) do nothing;
  for i in 1..6 loop
    update public.workflow_outbox set available_at = now()
    where kind = 'watch_sighting_alert' and aggregate_id = v_sighting_id;
    select * into claimed from public.claim_workflow_outbox(1)
    where aggregate_id = v_sighting_id and kind = 'watch_sighting_alert';
    if claimed.id is null then raise exception 'PS-425 failed to reclaim attempt %', i; end if;
    perform public.complete_workflow_outbox(claimed.id, false, 'fixture provider failure');
  end loop;
  if exists (select 1 from public.claim_workflow_outbox(100) where aggregate_id = v_sighting_id and kind = 'watch_sighting_alert') then
    raise exception 'PS-425 exceeded the six-attempt provider cap';
  end if;

  -- Quiet-period deferral leaves the item pending and restores its attempt budget.
  update public.workflow_outbox set attempts = 1, status = 'processing', locked_at = now()
  where kind = 'watch_sighting_alert' and aggregate_id = v_sighting_id;
  perform public.defer_workflow_outbox((select id from public.workflow_outbox where kind = 'watch_sighting_alert' and aggregate_id = v_sighting_id), 30);
  if not exists (select 1 from public.workflow_outbox where kind = 'watch_sighting_alert' and aggregate_id = v_sighting_id and status = 'pending' and attempts = 0 and available_at > now() + interval '29 minutes') then
    raise exception 'PS-425 quiet-period deferral was not durable';
  end if;
end;
$$;

rollback;
