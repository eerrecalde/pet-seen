-- PS-408 automatic found-pet matching regression coverage.
-- Run against the local database with:
-- docker exec -i supabase_db_pet-seen psql -v ON_ERROR_STOP=1 -U postgres -d postgres < tests/sql/ps408_automatic_found_match.sql

begin;

do $$
declare
  staff_id uuid := gen_random_uuid();
  owner_id uuid := gen_random_uuid();
  first_pet_id uuid := gen_random_uuid();
  second_pet_id uuid := gen_random_uuid();
  first_case_id uuid := gen_random_uuid();
  second_case_id uuid := gen_random_uuid();
  report_id uuid := gen_random_uuid();
  first_run_id uuid := gen_random_uuid();
  second_run_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values
    (staff_id, 'authenticated', 'authenticated', 'ps408-auto-staff@example.test', '{}', '{}', now(), now()),
    (owner_id, 'authenticated', 'authenticated', 'ps408-auto-owner@example.test', '{}', '{}', now(), now());
  insert into public.user_roles (user_id, role)
  values (staff_id, 'moderator');
  insert into public.pets (id, owner_id, name, species, breed)
  values
    (first_pet_id, owner_id, 'First PS-408 pet', 'dog', 'Labrador'),
    (second_pet_id, owner_id, 'Second PS-408 pet', 'dog', 'Poodle');
  insert into public.missing_cases (
    id, owner_id, pet_id, public_slug, status, exact_location, last_seen_at, published_at
  ) values
    (
      first_case_id, owner_id, first_pet_id, 'ps408auto01', 'published',
      extensions.st_setsrid(extensions.st_makepoint(-0.1276, 51.5072), 4326),
      now() - interval '40 days', now()
    ),
    (
      second_case_id, owner_id, second_pet_id, 'ps408auto02', 'published',
      extensions.st_setsrid(extensions.st_makepoint(-0.1275, 51.5073), 4326),
      now() - interval '1 hour', now()
    );
  insert into public.found_pet_reports (
    id, species, breed, details, custody_status, exact_location, found_at,
    client_submission_id, moderation_status, moderated_at, moderated_by
  ) values (
    report_id, 'dog', 'Labrador', 'PS-408 automatic match test', 'with_reporter',
    extensions.st_setsrid(extensions.st_makepoint(-0.1274, 51.5074), 4326),
    now(), gen_random_uuid(), 'approved', now(), staff_id
  );
  insert into public.ai_found_pet_match_runs (
    id, found_pet_report_id, model, candidate_count, status, failure_reason, completed_at, created_at
  ) values (
    first_run_id, report_id, 'test', 2, 'completed', null, now(), now()
  );
  insert into public.ai_found_pet_match_scores (
    run_id, found_pet_report_id, case_id, deterministic_score, ai_similarity_score,
    combined_score, confidence, explanation
  ) values
    (first_run_id, report_id, first_case_id, 75, 100, 84, 'high', 'Top combined score, but weak deterministic evidence.'),
    (first_run_id, report_id, second_case_id, 85, 77, 82, 'high', 'Strong deterministic evidence.');

  perform set_config('request.jwt.claim.sub', staff_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  if public.create_provisional_found_pet_match(report_id) then
    raise exception 'PS-408 must not auto-link a lower-ranked qualifying candidate';
  end if;
  if exists (select 1 from public.found_pet_case_links where found_pet_report_id = report_id) then
    raise exception 'PS-408 created a link when the overall top candidate missed a threshold';
  end if;

  insert into public.ai_found_pet_match_runs (
    id, found_pet_report_id, model, candidate_count, status, failure_reason, completed_at, created_at
  ) values (
    second_run_id, report_id, 'test', 2, 'completed', null,
    now() + interval '1 second', now() + interval '1 second'
  );
  insert into public.ai_found_pet_match_scores (
    run_id, found_pet_report_id, case_id, deterministic_score, ai_similarity_score,
    combined_score, confidence, explanation
  ) values
    (second_run_id, report_id, first_case_id, 75, 80, 77, 'high', 'No longer the top candidate.'),
    (second_run_id, report_id, second_case_id, 85, 77, 82, 'high', 'Highest qualifying candidate.');

  if not public.create_provisional_found_pet_match(report_id) then
    raise exception 'PS-408 did not link the overall highest qualifying candidate';
  end if;
  if not exists (
    select 1 from public.found_pet_case_links
    where found_pet_report_id = report_id and case_id = second_case_id and status = 'pending_owner'
  ) then
    raise exception 'PS-408 linked the wrong automatic candidate';
  end if;
  if not exists (
    select 1 from public.owner_found_pet_match_notifications
    where found_pet_report_id = report_id and case_id = second_case_id and recipient_id = owner_id
  ) then
    raise exception 'PS-408 did not queue a possible-match owner notification';
  end if;
  if not exists (
    select 1 from public.workflow_outbox
    where kind = 'owner_found_pet_match_email'
  ) then
    raise exception 'PS-408 did not queue durable possible-match email delivery';
  end if;
  if public.create_provisional_found_pet_match(report_id) then
    raise exception 'PS-408 rerun created another active owner-review link';
  end if;
  if (select count(*) from public.found_pet_case_links where found_pet_report_id = report_id and status = 'pending_owner') <> 1 then
    raise exception 'PS-408 must retain only one active owner-review link';
  end if;
end;
$$;

rollback;
