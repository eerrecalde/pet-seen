-- PS-408: AI matching is private staff decision support. It can prioritise a
-- deterministic shortlist but can never create a case link or notify an owner.

create type public.ai_match_confidence as enum ('low', 'medium', 'high');
create type public.ai_match_run_status as enum ('completed', 'failed');

create table public.ai_found_pet_match_runs (
  id uuid primary key default gen_random_uuid(),
  found_pet_report_id uuid not null references public.found_pet_reports (id) on delete cascade,
  requested_by uuid not null references auth.users (id) on delete restrict,
  model text not null,
  candidate_count smallint not null check (candidate_count between 1 and 5),
  status public.ai_match_run_status not null,
  failure_reason text check (failure_reason is null or char_length(failure_reason) <= 240),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint ai_found_pet_match_run_state check (
    (status = 'completed' and completed_at is not null and failure_reason is null)
    or (status = 'failed' and completed_at is not null and failure_reason is not null)
  )
);

create table public.ai_found_pet_match_scores (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.ai_found_pet_match_runs (id) on delete cascade,
  found_pet_report_id uuid not null references public.found_pet_reports (id) on delete cascade,
  case_id uuid not null references public.missing_cases (id) on delete restrict,
  deterministic_score smallint not null check (deterministic_score between 0 and 100),
  ai_similarity_score smallint not null check (ai_similarity_score between 0 and 100),
  combined_score smallint not null check (combined_score between 0 and 100),
  confidence public.ai_match_confidence not null,
  explanation text not null check (char_length(trim(explanation)) between 1 and 800),
  priority_review boolean not null default false,
  created_at timestamptz not null default now(),
  unique (run_id, case_id)
);

create index ai_found_pet_match_runs_report_created_idx on public.ai_found_pet_match_runs (found_pet_report_id, created_at desc);
create index ai_found_pet_match_scores_report_created_idx on public.ai_found_pet_match_scores (found_pet_report_id, created_at desc);

alter table public.ai_found_pet_match_runs enable row level security;
alter table public.ai_found_pet_match_scores enable row level security;
revoke all on public.ai_found_pet_match_runs, public.ai_found_pet_match_scores from anon, authenticated;
grant select on public.ai_found_pet_match_runs, public.ai_found_pet_match_scores to authenticated;

create policy "Staff can read AI found-pet match runs"
  on public.ai_found_pet_match_runs for select to authenticated
  using ((select public.is_authorized_staff()));
create policy "Staff can read AI found-pet match scores"
  on public.ai_found_pet_match_scores for select to authenticated
  using ((select public.is_authorized_staff()));

-- Unlinked sightings have no pet photo, so this companion audit trail records
-- description-assisted scoring against a conservative nearby shortlist.
create table public.ai_unlinked_sighting_match_runs (
  id uuid primary key default gen_random_uuid(),
  sighting_id uuid not null references public.sightings (id) on delete cascade,
  requested_by uuid not null references auth.users (id) on delete restrict,
  model text not null,
  candidate_count smallint not null check (candidate_count between 1 and 5),
  created_at timestamptz not null default now()
);
create table public.ai_unlinked_sighting_match_scores (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.ai_unlinked_sighting_match_runs (id) on delete cascade,
  sighting_id uuid not null references public.sightings (id) on delete cascade,
  case_id uuid not null references public.missing_cases (id) on delete restrict,
  deterministic_score smallint not null check (deterministic_score between 0 and 100),
  ai_similarity_score smallint not null check (ai_similarity_score between 0 and 100),
  combined_score smallint not null check (combined_score between 0 and 100),
  confidence public.ai_match_confidence not null,
  explanation text not null check (char_length(trim(explanation)) between 1 and 800),
  priority_review boolean not null default false,
  created_at timestamptz not null default now(),
  unique (run_id, case_id)
);
create index ai_unlinked_sighting_runs_sighting_created_idx on public.ai_unlinked_sighting_match_runs (sighting_id, created_at desc);
create index ai_unlinked_sighting_scores_sighting_created_idx on public.ai_unlinked_sighting_match_scores (sighting_id, created_at desc);
alter table public.ai_unlinked_sighting_match_runs enable row level security;
alter table public.ai_unlinked_sighting_match_scores enable row level security;
revoke all on public.ai_unlinked_sighting_match_runs, public.ai_unlinked_sighting_match_scores from anon, authenticated;
grant select on public.ai_unlinked_sighting_match_runs, public.ai_unlinked_sighting_match_scores to authenticated;
create policy "Staff can read AI sighting match runs" on public.ai_unlinked_sighting_match_runs for select to authenticated using ((select public.is_authorized_staff()));
create policy "Staff can read AI sighting match scores" on public.ai_unlinked_sighting_match_scores for select to authenticated using ((select public.is_authorized_staff()));

create function public.unlinked_sighting_case_candidates(target_sighting_id uuid)
returns table (case_id uuid, public_slug text, pet_name text, breed text, colour text, last_seen_at timestamptz, distance_km numeric, match_score smallint, match_reasons text[])
language sql security definer set search_path = public, extensions as $$
  with sighting as (select * from public.sightings where id = target_sighting_id and case_id is null and public.is_authorized_staff()), candidates as (
    select c.id, c.public_slug, p.name, p.breed, p.colour, c.last_seen_at, s.seen_at,
      extensions.st_distance(s.exact_location::extensions.geography, c.exact_location::extensions.geography) / 1000 as distance_km
    from sighting s join public.missing_cases c on c.status = 'published' and c.exact_location is not null join public.pets p on p.id = c.pet_id
    where extensions.st_dwithin(s.exact_location::extensions.geography, c.exact_location::extensions.geography, 30000)
  ), scored as (select *, 20 + case when distance_km <= 2 then 35 when distance_km <= 10 then 20 else 8 end + case when last_seen_at is not null and seen_at >= last_seen_at and seen_at - last_seen_at <= interval '2 days' then 25 when last_seen_at is not null and seen_at >= last_seen_at and seen_at - last_seen_at <= interval '7 days' then 15 when last_seen_at is not null and seen_at >= last_seen_at and seen_at - last_seen_at <= interval '30 days' then 8 else 0 end as score from candidates)
  select id, public_slug, name, breed, colour, last_seen_at, round(distance_km::numeric, 1), least(score, 100)::smallint, array_remove(array['Nearby active case', case when distance_km <= 2 then 'Seen within 2 km' when distance_km <= 10 then 'Seen within 10 km' else 'Seen within 30 km' end], null) from scored order by score desc, distance_km asc, last_seen_at desc nulls last limit 5;
$$;
revoke all on function public.unlinked_sighting_case_candidates(uuid) from public;
grant execute on function public.unlinked_sighting_case_candidates(uuid) to authenticated;

-- PS-408 supersedes PS-403's automatic provisional owner match. Staff can
-- still link an approved report after reviewing deterministic and AI evidence.
create or replace function public.review_found_pet_report(target_report_id uuid, decision public.found_pet_moderation_status)
returns void language plpgsql security definer set search_path = public as $$
begin
  if decision not in ('approved', 'rejected') or not public.is_authorized_staff() then raise exception 'Only Pet Seen staff can moderate found-pet reports'; end if;
  update public.found_pet_reports set moderation_status = decision, moderated_at = now(), moderated_by = auth.uid() where id = target_report_id and moderation_status = 'pending';
  if not found then raise exception 'This report is no longer awaiting review'; end if;
  insert into public.found_pet_report_moderation_audit (found_pet_report_id, event, actor_id) values (target_report_id, decision::text, auth.uid());
end;
$$;
