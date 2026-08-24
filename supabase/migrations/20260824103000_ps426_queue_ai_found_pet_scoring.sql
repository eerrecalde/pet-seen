-- PS-426: Provider work must be durable, bounded and auditable.  These limits
-- are deliberately conservative; changing them is an explicit operations change.

alter table public.found_pet_reports
  add column if not exists ai_scoring_version integer not null default 1;

create table public.ai_found_pet_scoring_queue (
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
  unique(found_pet_report_id, report_version)
);
create index ai_found_pet_scoring_queue_claim_idx on public.ai_found_pet_scoring_queue(status, available_at)
  where status = 'pending';

alter table public.ai_found_pet_match_runs
  add column if not exists report_version integer not null default 1,
  add column if not exists queue_id uuid references public.ai_found_pet_scoring_queue(id) on delete set null,
  add column if not exists outcome text not null default 'completed',
  add column if not exists latency_ms integer check (latency_ms is null or latency_ms >= 0),
  add column if not exists input_tokens integer check (input_tokens is null or input_tokens >= 0),
  add column if not exists output_tokens integer check (output_tokens is null or output_tokens >= 0),
  add column if not exists estimated_cost_cents integer not null default 0 check (estimated_cost_cents >= 0);
create unique index if not exists ai_found_pet_match_runs_report_version_completed_idx
  on public.ai_found_pet_match_runs(found_pet_report_id, report_version)
  where status = 'completed';

create table public.ai_provider_budget_guardrails (
  singleton boolean primary key default true check (singleton),
  daily_cents integer not null check (daily_cents > 0),
  monthly_cents integer not null check (monthly_cents > 0),
  max_runs_per_hour integer not null check (max_runs_per_hour > 0),
  max_candidate_images smallint not null check (max_candidate_images between 0 and 5),
  max_image_bytes integer not null check (max_image_bytes between 100000 and 5000000)
);
insert into public.ai_provider_budget_guardrails(singleton, daily_cents, monthly_cents, max_runs_per_hour, max_candidate_images, max_image_bytes)
values (true, 1000, 20000, 10, 3, 1500000)
on conflict (singleton) do nothing;

alter table public.ai_found_pet_scoring_queue enable row level security;
alter table public.ai_provider_budget_guardrails enable row level security;
revoke all on public.ai_found_pet_scoring_queue, public.ai_provider_budget_guardrails from anon, authenticated;
grant select on public.ai_found_pet_scoring_queue, public.ai_provider_budget_guardrails to authenticated;
create policy "Staff can read AI scoring queue" on public.ai_found_pet_scoring_queue for select to authenticated using ((select public.is_authorized_staff()));
create policy "Staff can read AI budget guardrails" on public.ai_provider_budget_guardrails for select to authenticated using ((select public.is_authorized_staff()));
grant select, insert, update on public.ai_found_pet_scoring_queue, public.ai_provider_budget_guardrails to service_role;

create or replace function public.enqueue_found_pet_ai_scoring(target_report_id uuid, actor_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare version integer; job_id uuid;
begin
  if not (coalesce(auth.role(), '') = 'service_role' or public.is_authorized_staff()) then raise exception 'Only staff can queue AI candidate scoring'; end if;
  select ai_scoring_version into version from public.found_pet_reports
    where id = target_report_id and moderation_status = 'approved' and lifecycle_status = 'active';
  if version is null then raise exception 'This active approved report is not available for scoring'; end if;
  insert into public.ai_found_pet_scoring_queue(found_pet_report_id, report_version, requested_by)
    values (target_report_id, version, actor_id)
    on conflict (found_pet_report_id, report_version) do update set
      available_at = least(public.ai_found_pet_scoring_queue.available_at, now()),
      status = case when public.ai_found_pet_scoring_queue.status in ('failed', 'skipped') then 'pending' else public.ai_found_pet_scoring_queue.status end,
      last_error = null
    returning id into job_id;
  return job_id;
end $$;

create or replace function public.claim_found_pet_ai_scoring_jobs(max_jobs integer default 1)
returns setof public.ai_found_pet_scoring_queue language plpgsql security definer set search_path = public as $$
declare limits public.ai_provider_budget_guardrails; spent_day integer; spent_month integer; recent_runs integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required'; end if;
  select * into limits from public.ai_provider_budget_guardrails where singleton;
  select coalesce(sum(estimated_cost_cents), 0) into spent_day from public.ai_found_pet_match_runs where created_at >= date_trunc('day', now());
  select coalesce(sum(estimated_cost_cents), 0) into spent_month from public.ai_found_pet_match_runs where created_at >= date_trunc('month', now());
  select count(*) into recent_runs from public.ai_found_pet_match_runs where created_at >= now() - interval '1 hour';
  if spent_day >= limits.daily_cents or spent_month >= limits.monthly_cents or recent_runs >= limits.max_runs_per_hour then
    update public.ai_found_pet_scoring_queue set status = 'skipped', completed_at = now(), last_error = 'Provider budget or rate limit reached; staff review required.'
      where status = 'pending' and available_at <= now();
    return;
  end if;
  return query
    with jobs as (select id from public.ai_found_pet_scoring_queue where status = 'pending' and available_at <= now() order by created_at for update skip locked limit greatest(1, least(max_jobs, 3)))
    update public.ai_found_pet_scoring_queue q set status = 'running', attempts = q.attempts + 1, leased_until = now() + interval '5 minutes'
    from jobs where q.id = jobs.id returning q.*;
end $$;
grant execute on function public.enqueue_found_pet_ai_scoring(uuid, uuid), public.claim_found_pet_ai_scoring_jobs(integer) to service_role, authenticated;

-- A report edit that changes matching evidence gets a new idempotency key.
create or replace function public.bump_found_pet_ai_scoring_version() returns trigger language plpgsql as $$
begin
  if (old.species, old.breed, old.colour, old.details, old.found_at, old.exact_location)
       is distinct from (new.species, new.breed, new.colour, new.details, new.found_at, new.exact_location) then
    new.ai_scoring_version := old.ai_scoring_version + 1;
  end if;
  return new;
end $$;
drop trigger if exists found_pet_ai_scoring_version on public.found_pet_reports;
create trigger found_pet_ai_scoring_version before update on public.found_pet_reports
  for each row execute function public.bump_found_pet_ai_scoring_version();
