-- PS-413: keep what people entered for display, while comparing stable values.

create or replace function public.pet_match_canonical(input text)
returns text language sql immutable strict parallel safe as $$
  with canonical as (select nullif(regexp_replace(lower(trim(input)), '[^[:alnum:]]', '', 'g'), '') as value)
  select case when value in ('unknown', 'mixed', 'other') then null else value end from canonical;
$$;

create or replace function public.pet_colour_tokens(input text)
returns text[] language sql immutable strict parallel safe as $$
  with tokens as (
    select case when token = 'grey' then 'gray' else token end as token
    from regexp_split_to_table(regexp_replace(lower(trim(input)), '[^[:alnum:]]+', ' ', 'g'), '\s+') as token
  )
  select coalesce(array_agg(token order by token), '{}')
  from (
    select distinct token from tokens
    where token <> '' and token not in ('a', 'an', 'and', 'or', 'the', 'with', 'unknown', 'mixed', 'other')
  ) meaningful_tokens;
$$;

create or replace function public.pet_has_safe_partial_breed_match(left_breed text, right_breed text)
returns boolean language sql immutable parallel safe as $$
  with values as (
    select public.pet_match_canonical(left_breed) as left_value,
           public.pet_match_canonical(right_breed) as right_value
  ), ordered as (
    select left_value, right_value, least(left_value, right_value) as shorter, greatest(left_value, right_value) as longer from values
  )
  select left_value is not null and right_value is not null and shorter is not null
    and char_length(shorter) >= 8
    and shorter not in ('unknown', 'mixed', 'other', 'crossbreed', 'mongrel', 'terrier', 'spaniel', 'shepherd', 'retriever', 'poodle', 'hound', 'shorthair', 'longhair', 'domesticshort', 'domesticlong')
    and position(shorter in longer) > 0
  from ordered;
$$;

create or replace function public.found_pet_case_candidates(target_report_id uuid)
returns table (case_id uuid, public_slug text, pet_name text, breed text, colour text, last_seen_at timestamptz, distance_km numeric, match_score smallint, match_reasons text[])
language sql security definer set search_path = public, extensions as $$
  with report as (
    select * from public.found_pet_reports
    where id = target_report_id and (public.is_authorized_staff() or coalesce(auth.role(), '') = 'service_role')
  ), candidates as (
    select c.id as candidate_case_id, c.public_slug, p.name as candidate_pet_name, p.breed as candidate_breed, p.colour as candidate_colour, c.last_seen_at,
      extensions.st_distance(r.exact_location::extensions.geography, c.exact_location::extensions.geography) / 1000 as candidate_distance_km,
      r.found_at, r.breed as report_breed, r.colour as report_colour,
      public.pet_match_canonical(r.breed) = public.pet_match_canonical(p.breed) and public.pet_match_canonical(r.breed) is not null as exact_breed,
      public.pet_has_safe_partial_breed_match(r.breed, p.breed) as partial_breed,
      public.pet_colour_tokens(r.colour) = public.pet_colour_tokens(p.colour) and cardinality(public.pet_colour_tokens(r.colour)) > 0 as exact_colour,
      public.pet_colour_tokens(r.colour) && public.pet_colour_tokens(p.colour) and cardinality(public.pet_colour_tokens(r.colour)) > 0 and cardinality(public.pet_colour_tokens(p.colour)) > 0 as partial_colour
    from report r join public.missing_cases c on c.status = 'published' and c.exact_location is not null
    join public.pets p on p.id = c.pet_id and p.species = r.species
    where extensions.st_dwithin(r.exact_location::extensions.geography, c.exact_location::extensions.geography, 30000)
  ), scored as (
    select *, 35 + case when candidate_distance_km <= 2 then 30 when candidate_distance_km <= 10 then 15 when candidate_distance_km <= 30 then 5 else 0 end
      + case when last_seen_at is not null and found_at >= last_seen_at and found_at - last_seen_at <= interval '2 days' then 20 when last_seen_at is not null and found_at >= last_seen_at and found_at - last_seen_at <= interval '7 days' then 12 when last_seen_at is not null and found_at >= last_seen_at and found_at - last_seen_at <= interval '30 days' then 6 else 0 end
      + case when exact_breed then 10 when partial_breed then 5 else 0 end
      + case when exact_colour then 5 when partial_colour then 2 else 0 end as score from candidates
  )
  select candidate_case_id, public_slug, candidate_pet_name, candidate_breed, candidate_colour, last_seen_at, round(candidate_distance_km::numeric, 1), least(score, 100)::smallint,
    array_remove(array['Same species', case when candidate_distance_km <= 2 then 'Found within 2 km' when candidate_distance_km <= 10 then 'Found within 10 km' when candidate_distance_km <= 30 then 'Found within 30 km' end, case when last_seen_at is not null and found_at >= last_seen_at and found_at - last_seen_at <= interval '2 days' then 'Reported within 2 days of last seen' when last_seen_at is not null and found_at >= last_seen_at and found_at - last_seen_at <= interval '7 days' then 'Reported within 7 days of last seen' when last_seen_at is not null and found_at >= last_seen_at and found_at - last_seen_at <= interval '30 days' then 'Reported within 30 days of last seen' end, case when exact_breed then 'Matching breed' when partial_breed then 'Similar breed' end, case when exact_colour then 'Matching markings' when partial_colour then 'Similar markings' end], null)
  from scored order by score desc, candidate_distance_km asc, last_seen_at desc nulls last limit 5;
$$;
