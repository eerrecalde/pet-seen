-- PS-403: staff-only, deterministic candidate matching for private found-pet
-- reports. Scores are decision support, never an automatic link or notification.

create table public.found_pet_case_links (
  found_pet_report_id uuid primary key references public.found_pet_reports (id) on delete cascade,
  case_id uuid not null references public.missing_cases (id) on delete restrict,
  match_score smallint not null check (match_score between 0 and 100),
  match_reasons text[] not null default '{}',
  linked_by uuid not null references auth.users (id) on delete restrict,
  linked_at timestamptz not null default now()
);

create index found_pet_case_links_case_id_idx on public.found_pet_case_links (case_id);

alter table public.found_pet_case_links enable row level security;
revoke all on public.found_pet_case_links from anon, authenticated;

create policy "Staff can read found pet case links"
  on public.found_pet_case_links for select to authenticated
  using ((select public.is_authorized_staff()));

create function public.found_pet_case_candidates(target_report_id uuid)
returns table (
  case_id uuid,
  public_slug text,
  pet_name text,
  breed text,
  colour text,
  last_seen_at timestamptz,
  distance_km numeric,
  match_score smallint,
  match_reasons text[]
)
language sql
security definer
set search_path = public, extensions
as $$
  with report as (
    select * from public.found_pet_reports
    where id = target_report_id and public.is_authorized_staff()
  ), candidates as (
    select
      c.id as candidate_case_id,
      c.public_slug,
      p.name as candidate_pet_name,
      p.breed as candidate_breed,
      p.colour as candidate_colour,
      c.last_seen_at,
      extensions.st_distance(r.exact_location::extensions.geography, c.exact_location::extensions.geography) / 1000 as candidate_distance_km,
      r.found_at,
      r.breed as report_breed,
      r.colour as report_colour
    from report r
    join public.missing_cases c on c.status = 'published' and c.exact_location is not null
    join public.pets p on p.id = c.pet_id and p.species = r.species
    where extensions.st_dwithin(r.exact_location::extensions.geography, c.exact_location::extensions.geography, 30000)
  ), scored as (
    select *,
      35
      + case when candidate_distance_km <= 2 then 30 when candidate_distance_km <= 10 then 15 when candidate_distance_km <= 30 then 5 else 0 end
      + case when last_seen_at is not null and found_at >= last_seen_at and found_at - last_seen_at <= interval '2 days' then 20 when last_seen_at is not null and found_at >= last_seen_at and found_at - last_seen_at <= interval '7 days' then 12 when last_seen_at is not null and found_at >= last_seen_at and found_at - last_seen_at <= interval '30 days' then 6 else 0 end
      + case when nullif(lower(trim(report_breed)), '') is not null and lower(trim(report_breed)) = lower(trim(candidate_breed)) then 10 else 0 end
      + case when nullif(lower(trim(report_colour)), '') is not null and lower(trim(report_colour)) = lower(trim(candidate_colour)) then 5 else 0 end as score
    from candidates
  )
  select candidate_case_id, public_slug, candidate_pet_name, candidate_breed, candidate_colour, last_seen_at,
    round(candidate_distance_km::numeric, 1), least(score, 100)::smallint,
    array_remove(array[
      'Same species',
      case when candidate_distance_km <= 2 then 'Found within 2 km' when candidate_distance_km <= 10 then 'Found within 10 km' when candidate_distance_km <= 30 then 'Found within 30 km' end,
      case when last_seen_at is not null and found_at >= last_seen_at and found_at - last_seen_at <= interval '2 days' then 'Reported within 2 days of last seen' when last_seen_at is not null and found_at >= last_seen_at and found_at - last_seen_at <= interval '7 days' then 'Reported within 7 days of last seen' when last_seen_at is not null and found_at >= last_seen_at and found_at - last_seen_at <= interval '30 days' then 'Reported within 30 days of last seen' end,
      case when nullif(lower(trim(report_breed)), '') is not null and lower(trim(report_breed)) = lower(trim(candidate_breed)) then 'Matching breed' end,
      case when nullif(lower(trim(report_colour)), '') is not null and lower(trim(report_colour)) = lower(trim(candidate_colour)) then 'Matching markings' end
    ], null)
  from scored
  order by score desc, candidate_distance_km asc, last_seen_at desc nulls last
  limit 5;
$$;

create function public.link_found_pet_report_to_case(target_report_id uuid, target_case_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare candidate record;
begin
  if not public.is_authorized_staff() then
    raise exception 'Only Pet Seen staff can link found-pet reports';
  end if;

  select * into candidate
  from public.found_pet_case_candidates(target_report_id)
  where case_id = target_case_id;
  if candidate.case_id is null then
    raise exception 'That active case is not a matching candidate';
  end if;

  insert into public.found_pet_case_links (found_pet_report_id, case_id, match_score, match_reasons, linked_by)
  values (target_report_id, target_case_id, candidate.match_score, candidate.match_reasons, auth.uid())
  on conflict (found_pet_report_id) do update set
    case_id = excluded.case_id,
    match_score = excluded.match_score,
    match_reasons = excluded.match_reasons,
    linked_by = excluded.linked_by,
    linked_at = now();
end;
$$;

revoke all on function public.found_pet_case_candidates(uuid) from public;
revoke all on function public.link_found_pet_report_to_case(uuid, uuid) from public;
grant execute on function public.found_pet_case_candidates(uuid) to authenticated;
grant execute on function public.link_found_pet_report_to_case(uuid, uuid) to authenticated;
