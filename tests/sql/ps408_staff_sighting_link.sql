-- PS-408 regression contract for staff sighting linking.
-- Run against the local database with:
-- docker exec -i supabase_db_pet-seen psql -U postgres -d postgres < tests/sql/ps408_staff_sighting_link.sql

begin;

do $$
declare definition text;
begin
  select pg_get_functiondef(
    'public.link_unlinked_sighting_to_case(uuid, uuid)'::regprocedure
  ) into definition;

  if position('unlinked_sighting_case_candidates' in definition) = 0 then
    raise exception 'PS-408 staff link must require the deterministic shortlist';
  end if;
  if position('priority_review' in definition) > 0 then
    raise exception 'PS-408 AI scoring must not gate a staff shortlist decision';
  end if;
  if position('workflow_outbox' in definition) = 0 then
    raise exception 'PS-419 owner notification handoff must remain durable';
  end if;
end;
$$;

do $$
declare
  staff_id uuid := gen_random_uuid();
  test_owner_id uuid := gen_random_uuid();
  pet_id uuid := gen_random_uuid();
  test_case_id uuid := gen_random_uuid();
  test_sighting_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values
    (staff_id, 'authenticated', 'authenticated', 'ps408-staff@example.test', '{}', '{}', now(), now()),
    (test_owner_id, 'authenticated', 'authenticated', 'ps408-owner@example.test', '{}', '{}', now(), now());
  insert into public.user_roles (user_id, role)
  values (staff_id, 'moderator');
  insert into public.pets (id, owner_id, name, species)
  values (pet_id, test_owner_id, 'PS-408 test pet', 'dog');
  insert into public.missing_cases (
    id, owner_id, pet_id, public_slug, status, exact_location, published_at
  ) values (
    test_case_id, test_owner_id, pet_id, 'ps408test01', 'published',
    extensions.st_setsrid(extensions.st_makepoint(-0.1276, 51.5072), 4326), now()
  );
  insert into public.sightings (
    id, exact_location, seen_at, location_description, details
  ) values (
    test_sighting_id,
    extensions.st_setsrid(extensions.st_makepoint(-0.1275, 51.5073), 4326),
    now() - interval '1 hour', 'PS-408 test location', 'PS-408 test sighting'
  );

  perform set_config('request.jwt.claim.sub', staff_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  if not exists (
    select 1 from public.unlinked_sighting_case_candidates(test_sighting_id) candidate
    where candidate.case_id = test_case_id
  ) then
    raise exception 'PS-408 test setup did not produce a conservative shortlist candidate';
  end if;

  perform public.link_unlinked_sighting_to_case(test_sighting_id, test_case_id);

  if not exists (
    select 1 from public.sightings
    where id = test_sighting_id and case_id = test_case_id
  ) then
    raise exception 'PS-408 staff could not link a shortlist candidate without an AI score';
  end if;
  if not exists (
    select 1 from public.owner_email_notifications
    where sighting_id = test_sighting_id and recipient_id = test_owner_id
  ) then
    raise exception 'PS-408 staff link did not queue the owner notification';
  end if;
  if not exists (
    select 1 from public.workflow_outbox
    where kind = 'owner_sighting_email' and aggregate_id = test_sighting_id
  ) then
    raise exception 'PS-408 staff link did not queue durable owner-email delivery';
  end if;
end;
$$;

rollback;
