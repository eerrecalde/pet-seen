-- PS-429: eligibility is a protected policy decision. Scores only rank the
-- eligible set; they never exclude a same-species case by themselves.

create table public.found_pet_matching_policy (
  id boolean primary key default true check (id),
  version integer not null default 1 check (version > 0),
  automatic_radius_m integer not null default 5000 check (automatic_radius_m between 1000 and 50000),
  elapsed_window interval not null default interval '30 days' check (elapsed_window between interval '1 day' and interval '90 days'),
  clock_allowance interval not null default interval '5 minutes' check (clock_allowance between interval '0 minutes' and interval '1 day'),
  automatic_candidate_cap smallint not null default 5 check (automatic_candidate_cap between 1 and 5),
  staff_search_candidate_cap smallint not null default 20 check (staff_search_candidate_cap between 1 and 50),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

insert into public.found_pet_matching_policy (id) values (true);

create table public.found_pet_matching_policy_audit (
  id bigint generated always as identity primary key,
  policy_version integer not null,
  actor_id uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now(),
  previous_policy jsonb,
  next_policy jsonb not null
);

alter table public.found_pet_matching_policy enable row level security;
alter table public.found_pet_matching_policy_audit enable row level security;
revoke all on public.found_pet_matching_policy, public.found_pet_matching_policy_audit from anon, authenticated;
grant select on public.found_pet_matching_policy, public.found_pet_matching_policy_audit to authenticated;
create policy "Staff can read found-pet matching policy" on public.found_pet_matching_policy for select to authenticated using ((select public.is_authorized_staff()));
create policy "Staff can read found-pet matching policy audit" on public.found_pet_matching_policy_audit for select to authenticated using ((select public.is_authorized_staff()));

create function public.update_found_pet_matching_policy(
  next_radius_m integer,
  next_elapsed_window interval,
  next_clock_allowance interval,
  next_automatic_candidate_cap integer,
  next_staff_search_candidate_cap integer
) returns void language plpgsql security definer set search_path = public as $$
declare previous public.found_pet_matching_policy%rowtype;
declare changed public.found_pet_matching_policy%rowtype;
begin
  if not public.is_authorized_staff() then raise exception 'Only Pet Seen staff can change matching policy'; end if;
  select * into previous from public.found_pet_matching_policy where id = true for update;
  update public.found_pet_matching_policy set
    version = previous.version + 1,
    automatic_radius_m = next_radius_m,
    elapsed_window = next_elapsed_window,
    clock_allowance = next_clock_allowance,
    automatic_candidate_cap = next_automatic_candidate_cap,
    staff_search_candidate_cap = next_staff_search_candidate_cap,
    updated_at = now(), updated_by = auth.uid()
  where id = true returning * into changed;
  insert into public.found_pet_matching_policy_audit (policy_version, actor_id, previous_policy, next_policy)
  values (changed.version, auth.uid(), to_jsonb(previous), to_jsonb(changed));
end;
$$;

alter table public.found_pet_report_moderation_audit
  drop constraint found_pet_report_moderation_audit_event_check,
  add constraint found_pet_report_moderation_audit_event_check check (event in (
    'submitted_for_review', 'approved', 'rejected', 'rejected_files_deleted',
    'automatically_approved', 'automatically_rejected', 'automatic_screening_failed',
    'photo_processing_started', 'photo_processing_completed', 'photo_processing_failed',
    'resolved', 'expired', 'reopened', 'deleted', 'deleted_files_deleted',
    'retention_deleted', 'retention_files_deleted', 'expanded_match_search', 'staff_linked_case'
  ));

create function public.found_pet_case_candidates_for_radius(target_report_id uuid, search_radius_m integer, candidate_cap smallint)
returns table (case_id uuid, public_slug text, pet_name text, breed text, colour text, last_seen_at timestamptz, distance_km numeric, match_score smallint, match_reasons text[])
language sql security definer set search_path = public, extensions as $$
  with report as (
    select r.*, policy.elapsed_window, policy.clock_allowance
    from public.found_pet_reports r cross join public.found_pet_matching_policy policy
    where r.id = target_report_id and r.moderation_status = 'approved' and r.lifecycle_status = 'active'
      and (public.is_authorized_staff() or coalesce(auth.role(), '') = 'service_role')
  ), candidates as (
    select c.id as candidate_case_id, c.public_slug, p.name as candidate_pet_name, p.breed as candidate_breed, p.colour as candidate_colour, c.last_seen_at,
      extensions.st_distance(r.exact_location::extensions.geography, c.exact_location::extensions.geography) / 1000 as candidate_distance_km,
      r.found_at, r.breed as report_breed, r.colour as report_colour, r.elapsed_window, r.clock_allowance,
      public.pet_match_canonical(r.breed) = public.pet_match_canonical(p.breed) and public.pet_match_canonical(r.breed) is not null as exact_breed,
      public.pet_has_safe_partial_breed_match(r.breed, p.breed) as partial_breed,
      public.pet_colour_tokens(r.colour) = public.pet_colour_tokens(p.colour) and cardinality(public.pet_colour_tokens(r.colour)) > 0 as exact_colour,
      public.pet_colour_tokens(r.colour) && public.pet_colour_tokens(p.colour) and cardinality(public.pet_colour_tokens(r.colour)) > 0 and cardinality(public.pet_colour_tokens(p.colour)) > 0 as partial_colour
    from report r join public.missing_cases c on c.status = 'published' and c.exact_location is not null
    join public.pets p on p.id = c.pet_id and p.species = r.species
    where extensions.st_dwithin(r.exact_location::extensions.geography, c.exact_location::extensions.geography, search_radius_m)
      and (
        c.last_seen_at is null
        or (
          c.last_seen_at <= r.found_at + r.clock_allowance
          and r.found_at <= c.last_seen_at + r.elapsed_window + r.clock_allowance
        )
      )
  ), ranked as (
    select *, 35 + case when candidate_distance_km <= 2 then 30 when candidate_distance_km <= 5 then 20 else 5 end
      + case when last_seen_at is null then 0 when abs(extract(epoch from (found_at - last_seen_at))) <= 2 * 86400 then 20 when abs(extract(epoch from (found_at - last_seen_at))) <= 7 * 86400 then 12 else 6 end
      + case when exact_breed then 10 when partial_breed then 5 else 0 end
      + case when exact_colour then 5 when partial_colour then 2 else 0 end as score
    from candidates
  )
  select candidate_case_id, public_slug, candidate_pet_name, candidate_breed, candidate_colour, last_seen_at, round(candidate_distance_km::numeric, 1), least(score, 100)::smallint,
    array_remove(array['Same species',
      case when last_seen_at is null then 'Last seen date unknown' else 'Within matching time window' end,
      case when exact_breed then 'Matching breed' when partial_breed then 'Similar breed' end,
      case when exact_colour then 'Matching markings' when partial_colour then 'Similar markings' end], null)
  from ranked order by score desc, candidate_distance_km asc, last_seen_at desc nulls last limit candidate_cap;
$$;

create or replace function public.found_pet_case_candidates(target_report_id uuid)
returns table (case_id uuid, public_slug text, pet_name text, breed text, colour text, last_seen_at timestamptz, distance_km numeric, match_score smallint, match_reasons text[])
language sql security definer set search_path = public as $$
  select candidates.* from public.found_pet_matching_policy policy
  cross join lateral public.found_pet_case_candidates_for_radius(target_report_id, policy.automatic_radius_m, policy.automatic_candidate_cap) candidates;
$$;

create function public.staff_found_pet_case_candidates(target_report_id uuid, search_radius_m integer default 50000)
returns table (case_id uuid, public_slug text, pet_name text, breed text, colour text, last_seen_at timestamptz, distance_km numeric, match_score smallint, match_reasons text[])
language plpgsql security definer set search_path = public as $$
declare policy public.found_pet_matching_policy%rowtype;
declare chosen_radius integer;
begin
  if not public.is_authorized_staff() then raise exception 'Only Pet Seen staff can expand found-pet matching'; end if;
  if search_radius_m not between 6000 and 100000 then raise exception 'Expanded search radius must be between 6 and 100 km'; end if;
  select * into policy from public.found_pet_matching_policy where id = true;
  chosen_radius := greatest(search_radius_m, policy.automatic_radius_m + 1);
  insert into public.found_pet_report_moderation_audit (found_pet_report_id, event, actor_id, metadata)
  values (target_report_id, 'expanded_match_search', auth.uid(), jsonb_build_object('radius_m', chosen_radius, 'policy_version', policy.version));
  return query select * from public.found_pet_case_candidates_for_radius(target_report_id, chosen_radius, policy.staff_search_candidate_cap);
end;
$$;

create or replace function public.link_found_pet_report_to_case(target_report_id uuid, target_case_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare candidate record;
declare policy_version integer;
begin
  if not public.is_authorized_staff() then raise exception 'Only Pet Seen staff can link found-pet reports'; end if;
  select * into candidate from public.found_pet_case_candidates_for_radius(target_report_id, 100000, 50::smallint) where case_id = target_case_id;
  if candidate.case_id is null then raise exception 'That case is not an active, same-species matching candidate'; end if;
  select version into policy_version from public.found_pet_matching_policy where id = true;
  insert into public.found_pet_case_links (found_pet_report_id, case_id, match_score, match_reasons, linked_by)
  values (target_report_id, target_case_id, candidate.match_score, candidate.match_reasons, auth.uid())
  on conflict (found_pet_report_id, case_id) do update set match_score = excluded.match_score, match_reasons = excluded.match_reasons, linked_by = excluded.linked_by, linked_at = now();
  insert into public.found_pet_report_moderation_audit (found_pet_report_id, event, actor_id, metadata)
  values (target_report_id, 'staff_linked_case', auth.uid(), jsonb_build_object('case_id', target_case_id, 'distance_km', candidate.distance_km, 'policy_version', policy_version));
end;
$$;

create or replace function public.create_provisional_found_pet_match(target_report_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare best record;
begin
  if exists (select 1 from public.found_pet_case_links where found_pet_report_id = target_report_id and status in ('pending_owner', 'confirmed')) then return false; end if;
  select candidate.*, score.combined_score, score.confidence into best
  from public.found_pet_case_candidates(target_report_id) candidate
  join lateral (
    select s.combined_score, s.confidence from public.ai_found_pet_match_scores s join public.ai_found_pet_match_runs r on r.id = s.run_id
    where s.found_pet_report_id = target_report_id and s.case_id = candidate.case_id order by r.created_at desc limit 1
  ) score on true
  order by score.combined_score desc, candidate.match_score desc, candidate.case_id limit 1;
  if best.case_id is null or best.combined_score < 80 or best.confidence not in ('medium'::public.ai_match_confidence, 'high'::public.ai_match_confidence) then return false; end if;
  insert into public.found_pet_case_links (found_pet_report_id, case_id, match_score, match_reasons)
  values (target_report_id, best.case_id, best.match_score, best.match_reasons) on conflict (found_pet_report_id, case_id) do nothing;
  return found;
end;
$$;

revoke all on function public.update_found_pet_matching_policy(integer, interval, interval, integer, integer), public.found_pet_case_candidates_for_radius(uuid, integer, smallint), public.staff_found_pet_case_candidates(uuid, integer) from public;
grant execute on function public.found_pet_case_candidates(uuid), public.staff_found_pet_case_candidates(uuid, integer), public.update_found_pet_matching_policy(integer, interval, interval, integer, integer) to authenticated;
grant execute on function public.found_pet_case_candidates_for_radius(uuid, integer, smallint), public.found_pet_case_candidates(uuid), public.create_provisional_found_pet_match(uuid) to service_role;
