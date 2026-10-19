-- PS-430: shadow jobs are independently durable and cannot share the image queue.
begin;

do $$
declare
  report_id uuid := gen_random_uuid();
  first_job uuid;
  second_job uuid;
  claimed public.jev_found_pet_assessment_queue;
begin
  insert into public.found_pet_reports (
    id, species, details, custody_status, exact_location, found_at,
    client_submission_id, moderation_status, moderated_at
  ) values (
    report_id, 'dog', 'PS-430 shadow queue test', 'with_reporter',
    extensions.st_setsrid(extensions.st_makepoint(-0.1278, 51.5074), 4326), now(),
    gen_random_uuid(), 'approved', now()
  );
  perform set_config('request.jwt.claim.role', 'service_role', true);

  perform public.enqueue_found_pet_ai_scoring(report_id);
  select id into first_job from public.jev_found_pet_assessment_queue
    where found_pet_report_id = report_id and report_version = 1;
  if first_job is null then
    raise exception 'PS-430 did not enqueue independent shadow work with image scoring';
  end if;
  second_job := public.enqueue_jev_found_pet_assessment(report_id);
  if first_job <> second_job then
    raise exception 'PS-430 did not make the shadow queue idempotent per report version';
  end if;
  if not exists (select 1 from public.ai_found_pet_scoring_queue where found_pet_report_id = report_id) then
    raise exception 'PS-430 did not preserve the existing image-scoring queue';
  end if;

  select * into claimed from public.claim_jev_found_pet_assessment_jobs(1);
  if claimed.id <> first_job or claimed.status <> 'running' or claimed.attempts <> 1 then
    raise exception 'PS-430 did not atomically claim the shadow assessment job';
  end if;
end;
$$;

rollback;
