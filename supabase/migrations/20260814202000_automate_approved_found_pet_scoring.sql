-- PS-408: scoring starts automatically after safe approval. Service-run
-- analyses have no human requester, while staff-triggered reruns retain one.

alter table public.ai_found_pet_match_runs alter column requested_by drop not null;

create or replace function public.found_pet_case_candidates(target_report_id uuid)
returns table (case_id uuid, public_slug text, pet_name text, breed text, colour text, last_seen_at timestamptz, distance_km numeric, match_score smallint, match_reasons text[])
language sql security definer set search_path = public, extensions as $$
  with report as (
    select * from public.found_pet_reports
    where id = target_report_id and (public.is_authorized_staff() or coalesce(auth.role(), '') = 'service_role')
  ), candidates as (
    select c.id as candidate_case_id, c.public_slug, p.name as candidate_pet_name, p.breed as candidate_breed, p.colour as candidate_colour, c.last_seen_at,
      extensions.st_distance(r.exact_location::extensions.geography, c.exact_location::extensions.geography) / 1000 as candidate_distance_km,
      r.found_at, r.breed as report_breed, r.colour as report_colour
    from report r join public.missing_cases c on c.status = 'published' and c.exact_location is not null
    join public.pets p on p.id = c.pet_id and p.species = r.species
    where extensions.st_dwithin(r.exact_location::extensions.geography, c.exact_location::extensions.geography, 30000)
  ), scored as (
    select *, 35 + case when candidate_distance_km <= 2 then 30 when candidate_distance_km <= 10 then 15 when candidate_distance_km <= 30 then 5 else 0 end
      + case when last_seen_at is not null and found_at >= last_seen_at and found_at - last_seen_at <= interval '2 days' then 20 when last_seen_at is not null and found_at >= last_seen_at and found_at - last_seen_at <= interval '7 days' then 12 when last_seen_at is not null and found_at >= last_seen_at and found_at - last_seen_at <= interval '30 days' then 6 else 0 end
      + case when nullif(lower(trim(report_breed)), '') is not null and lower(trim(report_breed)) = lower(trim(candidate_breed)) then 10 else 0 end
      + case when nullif(lower(trim(report_colour)), '') is not null and lower(trim(report_colour)) = lower(trim(candidate_colour)) then 5 else 0 end as score from candidates
  )
  select candidate_case_id, public_slug, candidate_pet_name, candidate_breed, candidate_colour, last_seen_at, round(candidate_distance_km::numeric, 1), least(score, 100)::smallint,
    array_remove(array['Same species', case when candidate_distance_km <= 2 then 'Found within 2 km' when candidate_distance_km <= 10 then 'Found within 10 km' when candidate_distance_km <= 30 then 'Found within 30 km' end, case when last_seen_at is not null and found_at >= last_seen_at and found_at - last_seen_at <= interval '2 days' then 'Reported within 2 days of last seen' when last_seen_at is not null and found_at >= last_seen_at and found_at - last_seen_at <= interval '7 days' then 'Reported within 7 days of last seen' when last_seen_at is not null and found_at >= last_seen_at and found_at - last_seen_at <= interval '30 days' then 'Reported within 30 days of last seen' end, case when nullif(lower(trim(report_breed)), '') is not null and lower(trim(report_breed)) = lower(trim(candidate_breed)) then 'Matching breed' end, case when nullif(lower(trim(report_colour)), '') is not null and lower(trim(report_colour)) = lower(trim(candidate_colour)) then 'Matching markings' end], null)
  from scored order by score desc, candidate_distance_km asc, last_seen_at desc nulls last limit 5;
$$;
