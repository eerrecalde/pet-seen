-- PS-430: Jev is a text-only, shadow-only provider. Its queue is deliberately
-- separate from image scoring so a rate limit can never delay, duplicate, or
-- otherwise alter image matching, links, rankings, or notifications.

create table public.jev_found_pet_assessment_queue (
  id uuid primary key default gen_random_uuid(),
  found_pet_report_id uuid not null references public.found_pet_reports(id) on delete cascade,
  report_version integer not null check (report_version > 0),
  requested_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'skipped', 'failed')),
  attempts smallint not null default 0 check (attempts between 0 and 3),
  available_at timestamptz not null default now(),
  leased_until timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 240),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (found_pet_report_id, report_version)
);
create index jev_found_pet_assessment_queue_claim_idx
  on public.jev_found_pet_assessment_queue(status, available_at)
  where status = 'pending';

create table public.jev_found_pet_assessment_runs (
  id uuid primary key default gen_random_uuid(),
  found_pet_report_id uuid not null references public.found_pet_reports(id) on delete cascade,
  queue_id uuid references public.jev_found_pet_assessment_queue(id) on delete set null,
  report_version integer not null check (report_version > 0),
  model text not null,
  rubric_version text not null,
  policy_version integer not null check (policy_version > 0),
  pipeline_version text not null,
  candidate_count smallint not null check (candidate_count between 0 and 5),
  status text not null check (status in ('running', 'completed', 'failed', 'skipped')),
  outcome text not null,
  failure_reason text check (failure_reason is null or char_length(failure_reason) <= 240),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  estimated_cost_microusd numeric(14,3) not null default 0 check (estimated_cost_microusd >= 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index jev_found_pet_assessment_runs_completed_version_idx
  on public.jev_found_pet_assessment_runs(found_pet_report_id, report_version)
  where status = 'completed';

create table public.jev_found_pet_candidate_assessments (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.jev_found_pet_assessment_runs(id) on delete cascade,
  found_pet_report_id uuid not null references public.found_pet_reports(id) on delete cascade,
  case_id uuid not null references public.missing_cases(id) on delete restrict,
  route text not null check (route in ('possible', 'uncertain', 'incompatible', 'staff_review')),
  probability numeric(5,4) check (probability is null or probability between 0 and 1),
  confidence public.ai_match_confidence,
  dimensions jsonb not null check (jsonb_typeof(dimensions) = 'array' and jsonb_array_length(dimensions) = 3),
  created_at timestamptz not null default now(),
  unique (run_id, case_id)
);
create index jev_found_pet_candidate_assessments_report_created_idx
  on public.jev_found_pet_candidate_assessments(found_pet_report_id, created_at desc);

alter table public.jev_found_pet_assessment_queue enable row level security;
alter table public.jev_found_pet_assessment_runs enable row level security;
alter table public.jev_found_pet_candidate_assessments enable row level security;
revoke all on public.jev_found_pet_assessment_queue, public.jev_found_pet_assessment_runs, public.jev_found_pet_candidate_assessments from anon, authenticated;
grant select on public.jev_found_pet_assessment_queue, public.jev_found_pet_assessment_runs, public.jev_found_pet_candidate_assessments to authenticated;
grant select, insert, update on public.jev_found_pet_assessment_queue, public.jev_found_pet_assessment_runs, public.jev_found_pet_candidate_assessments to service_role;
create policy "Staff can read Jev assessment queue" on public.jev_found_pet_assessment_queue for select to authenticated using ((select public.is_authorized_staff()));
create policy "Staff can read Jev assessment runs" on public.jev_found_pet_assessment_runs for select to authenticated using ((select public.is_authorized_staff()));
create policy "Staff can read Jev candidate assessments" on public.jev_found_pet_candidate_assessments for select to authenticated using ((select public.is_authorized_staff()));

create or replace function public.enqueue_jev_found_pet_assessment(target_report_id uuid, actor_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare version integer; job_id uuid;
begin
  if not (coalesce(auth.role(), '') = 'service_role' or public.is_authorized_staff()) then
    raise exception 'Only staff can queue Jev candidate assessment';
  end if;
  select ai_scoring_version into version from public.found_pet_reports
    where id = target_report_id and moderation_status = 'approved' and lifecycle_status = 'active';
  if version is null then raise exception 'This active approved report is not available for assessment'; end if;
  insert into public.jev_found_pet_assessment_queue(found_pet_report_id, report_version, requested_by)
    values (target_report_id, version, actor_id)
    on conflict (found_pet_report_id, report_version) do update set
      available_at = least(public.jev_found_pet_assessment_queue.available_at, now()),
      status = case when public.jev_found_pet_assessment_queue.status in ('failed', 'skipped') then 'pending' else public.jev_found_pet_assessment_queue.status end,
      last_error = null,
      completed_at = null
    returning id into job_id;
  return job_id;
end $$;

create or replace function public.claim_jev_found_pet_assessment_jobs(max_jobs integer default 1)
returns setof public.jev_found_pet_assessment_queue language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required'; end if;
  return query
    with jobs as (
      select id from public.jev_found_pet_assessment_queue
      where status = 'pending' and available_at <= now()
      order by created_at for update skip locked limit greatest(1, least(max_jobs, 3))
    )
    update public.jev_found_pet_assessment_queue q
    set status = 'running', attempts = q.attempts + 1, leased_until = now() + interval '5 minutes'
    from jobs where q.id = jobs.id returning q.*;
end $$;

grant execute on function public.enqueue_jev_found_pet_assessment(uuid, uuid), public.claim_jev_found_pet_assessment_jobs(integer)
  to service_role, authenticated;
