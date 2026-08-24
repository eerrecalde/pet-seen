-- PS-426 queue, idempotency and budget guardrail regression coverage.
-- Run with: docker exec -i supabase_db_pet-seen psql -v ON_ERROR_STOP=1 -U postgres -d postgres < tests/sql/ps426_ai_scoring_queue.sql

begin;

do $$
declare
  report_id uuid := gen_random_uuid();
  first_job uuid;
  second_job uuid;
  newer_job uuid;
begin
  insert into public.found_pet_reports (
    id, species, details, custody_status, exact_location, found_at,
    client_submission_id, moderation_status, moderated_at
  ) values (
    report_id, 'dog', 'PS-426 queue test', 'with_reporter',
    extensions.st_setsrid(extensions.st_makepoint(-0.1278, 51.5074), 4326), now(),
    gen_random_uuid(), 'approved', now()
  );
  perform set_config('request.jwt.claim.role', 'service_role', true);

  first_job := public.enqueue_found_pet_ai_scoring(report_id);
  second_job := public.enqueue_found_pet_ai_scoring(report_id);
  if first_job <> second_job then
    raise exception 'PS-426 did not make a same-version queue request idempotent';
  end if;

  update public.found_pet_reports set details = 'PS-426 edited matching evidence' where id = report_id;
  newer_job := public.enqueue_found_pet_ai_scoring(report_id);
  if newer_job = first_job then
    raise exception 'PS-426 did not create a new job for an evidence version';
  end if;

  update public.ai_provider_budget_guardrails
    set daily_cents = 1, monthly_cents = 1, max_runs_per_hour = 10;
  insert into public.ai_found_pet_match_runs (
    found_pet_report_id, model, candidate_count, status, failure_reason,
    completed_at, estimated_cost_cents
  ) values (report_id, 'test', 1, 'completed', null, now(), 1);
  perform public.claim_found_pet_ai_scoring_jobs(1);
  if exists (select 1 from public.ai_found_pet_scoring_queue where id = newer_job and status <> 'skipped') then
    raise exception 'PS-426 did not safely skip queued work after the daily budget cap';
  end if;
  if not exists (select 1 from public.ai_found_pet_scoring_queue where id = newer_job and last_error like 'Provider budget%') then
    raise exception 'PS-426 did not retain a staff-review reason for the budget skip';
  end if;
end;
$$;

rollback;
