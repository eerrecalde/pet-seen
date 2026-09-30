-- PS-429 matching-policy regression coverage.
-- Run with: docker exec -i supabase_db_pet-seen psql -v ON_ERROR_STOP=1 -U postgres -d postgres < tests/sql/ps429_matching_policy.sql

begin;

do $$
declare
  staff_id uuid := gen_random_uuid();
  owner_id uuid := gen_random_uuid();
  report_id uuid := gen_random_uuid();
  within_case_id uuid := gen_random_uuid();
  boundary_case_id uuid := gen_random_uuid();
  outside_case_id uuid := gen_random_uuid();
  stale_case_id uuid := gen_random_uuid();
  unknown_case_id uuid := gen_random_uuid();
  mismatch_case_id uuid := gen_random_uuid();
  future_case_id uuid := gen_random_uuid();
  pet_ids uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  origin extensions.geometry := extensions.st_setsrid(extensions.st_makepoint(-0.1276, 51.5072), 4326);
begin
  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (staff_id, 'authenticated', 'authenticated', 'ps429-staff@example.test', '{}', '{}', now(), now()),
    (owner_id, 'authenticated', 'authenticated', 'ps429-owner@example.test', '{}', '{}', now(), now());
  insert into public.user_roles (user_id, role) values (staff_id, 'moderator');
  perform set_config('request.jwt.claim.sub', staff_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  if (select automatic_radius_m from public.found_pet_matching_policy) <> 5000
    or (select elapsed_window from public.found_pet_matching_policy) <> interval '30 days' then
    raise exception 'PS-429 default matching policy is incorrect';
  end if;
  perform public.update_found_pet_matching_policy(5000, interval '30 days', interval '5 minutes', 5, 20);
  if not exists (select 1 from public.found_pet_matching_policy_audit where actor_id = staff_id and policy_version = 2) then
    raise exception 'PS-429 policy changes must be audited';
  end if;

  insert into public.pets (id, owner_id, name, species, breed, colour) values
    (pet_ids[1], owner_id, 'Within', 'dog', 'Poodle', 'Black'),
    (pet_ids[2], owner_id, 'Boundary', 'dog', 'Poodle', 'Black'),
    (pet_ids[3], owner_id, 'Outside', 'dog', 'Poodle', 'Black'),
    (pet_ids[4], owner_id, 'Stale', 'dog', 'Poodle', 'Black'),
    (pet_ids[5], owner_id, 'Unknown', 'dog', 'Poodle', 'Black'),
    (pet_ids[6], owner_id, 'Mismatch', 'dog', 'Greyhound', 'White'),
    (pet_ids[7], owner_id, 'Future', 'dog', 'Poodle', 'Black');
  insert into public.found_pet_reports (id, species, breed, colour, details, custody_status, exact_location, found_at, client_submission_id, moderation_status, moderated_at, moderated_by)
  values (report_id, 'dog', 'Labrador', 'Brown', 'PS-429 policy test', 'with_reporter', origin, now(), gen_random_uuid(), 'approved', now(), staff_id);
  insert into public.missing_cases (id, owner_id, pet_id, public_slug, status, exact_location, last_seen_at, published_at) values
    (within_case_id, owner_id, pet_ids[1], 'ps429within', 'published', origin, now() - interval '1 day', now()),
    (boundary_case_id, owner_id, pet_ids[2], 'ps429boundary', 'published', extensions.st_project(origin::extensions.geography, 5000, 0)::extensions.geometry, now() - interval '30 days 5 minutes', now()),
    (outside_case_id, owner_id, pet_ids[3], 'ps429outside', 'published', extensions.st_project(origin::extensions.geography, 6000, 0)::extensions.geometry, now() - interval '1 day', now()),
    (stale_case_id, owner_id, pet_ids[4], 'ps429stale', 'published', origin, now() - interval '30 days 6 minutes', now()),
    (unknown_case_id, owner_id, pet_ids[5], 'ps429unknown', 'published', origin, null, now()),
    (mismatch_case_id, owner_id, pet_ids[6], 'ps429mismatch', 'published', origin, now() - interval '1 day', now()),
    (future_case_id, owner_id, pet_ids[7], 'ps429future', 'published', origin, now() + interval '6 minutes', now());

  if not exists (select 1 from public.found_pet_case_candidates(report_id) where case_id = boundary_case_id) then
    raise exception 'PS-429 must include the 5 km and time-window boundary';
  end if;
  if exists (select 1 from public.found_pet_case_candidates(report_id) where case_id in (outside_case_id, stale_case_id, future_case_id)) then
    raise exception 'PS-429 automatic eligibility leaked an outside-radius, stale, or future case';
  end if;
  if not exists (select 1 from public.found_pet_case_candidates(report_id) where case_id = unknown_case_id and 'Last seen date unknown' = any(match_reasons)) then
    raise exception 'PS-429 must retain missing last-seen dates as explicit unknown evidence';
  end if;
  if not exists (select 1 from public.found_pet_case_candidates(report_id) where case_id = mismatch_case_id) then
    raise exception 'PS-429 must not exclude a candidate for breed or colour mismatch';
  end if;

  if not exists (select 1 from public.staff_found_pet_case_candidates(report_id, 50000) where case_id = outside_case_id) then
    raise exception 'PS-429 staff expanded search must include candidates outside 5 km';
  end if;
  if not exists (select 1 from public.found_pet_report_moderation_audit where found_pet_report_id = report_id and event = 'expanded_match_search' and actor_id = staff_id) then
    raise exception 'PS-429 expanded search must be audited';
  end if;
  perform public.link_found_pet_report_to_case(report_id, outside_case_id);
  if not exists (select 1 from public.found_pet_case_links where found_pet_report_id = report_id and case_id = outside_case_id) then
    raise exception 'PS-429 staff must be able to link an eligible expanded-search candidate';
  end if;
  if not exists (select 1 from public.found_pet_report_moderation_audit where found_pet_report_id = report_id and event = 'staff_linked_case' and actor_id = staff_id) then
    raise exception 'PS-429 expanded link must be audited';
  end if;
end;
$$;

rollback;
