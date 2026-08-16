-- PS-413 deterministic matching matrix.
-- Run against the local database with:
-- docker exec -i supabase_db_pet-seen psql -U postgres -d postgres < tests/sql/ps413_matching.sql
--
-- Scores intentionally hold species (+35), distance within 2 km (+30), and
-- report timing within 2 days (+20) constant: an 85-point base. This isolates
-- the contribution from breed and colour/markings.

begin;

create temporary table ps413_cases (
  scenario text primary key,
  report_breed text,
  case_breed text,
  report_colour text,
  case_colour text,
  expected_breed_points smallint,
  expected_colour_points smallint,
  expected_score smallint
) on commit drop;

insert into ps413_cases values
  ('No descriptive evidence', null, null, null, null, 0, 0, 85),
  ('Breed ignores case, spaces and hyphens', ' Jack-Russell ', 'jack russell', null, null, 10, 0, 95),
  ('Breed exact after punctuation removal', 'Maine.Coon', 'maine coon', null, null, 10, 0, 95),
  ('Specific breed partial', 'British Shorthair cat', 'British Shorthair', null, null, 5, 0, 90),
  ('Generic breed partial is blocked', 'Terrier', 'Jack Russell terrier', null, null, 0, 0, 85),
  ('Unknown breed is not evidence', 'Unknown', 'unknown', null, null, 0, 0, 85),
  ('Mixed breed is not evidence', 'Mixed', 'mixed', null, null, 0, 0, 85),
  ('Exact markings ignore order and punctuation', null, null, 'black-and-white', ' White, black ', 0, 5, 90),
  ('Gray and grey are the same marking', null, null, 'grey and white', 'gray white', 0, 5, 90),
  ('Partial markings receive reduced credit', null, null, 'black', 'black and white', 0, 2, 87),
  ('Unrelated markings receive no credit', null, null, 'ginger', 'black and white', 0, 0, 85),
  ('Strong positive combines full evidence', 'Maine-Coon', 'maine coon', 'black and white', 'White, black', 10, 5, 100),
  ('Likely positive with partial evidence', 'British Shorthair cat', 'British Shorthair', 'grey', 'gray and white', 5, 2, 92);

create temporary table ps413_results on commit drop as
with scored as (
  select *,
    case when public.pet_match_canonical(report_breed) = public.pet_match_canonical(case_breed)
      and public.pet_match_canonical(report_breed) is not null then 10
      when public.pet_has_safe_partial_breed_match(report_breed, case_breed) then 5 else 0 end::smallint as breed_points,
    case when public.pet_colour_tokens(report_colour) = public.pet_colour_tokens(case_colour)
      and cardinality(public.pet_colour_tokens(report_colour)) > 0 then 5
      when public.pet_colour_tokens(report_colour) && public.pet_colour_tokens(case_colour)
        and cardinality(public.pet_colour_tokens(report_colour)) > 0
        and cardinality(public.pet_colour_tokens(case_colour)) > 0 then 2 else 0 end::smallint as colour_points
  from ps413_cases
)
select *, (85 + breed_points + colour_points)::smallint as score from scored;

select scenario, expected_breed_points, breed_points, expected_colour_points, colour_points, expected_score, score,
  case when expected_breed_points = breed_points and expected_colour_points = colour_points and expected_score = score then 'PASS' else 'FAIL' end as result
from ps413_results
order by scenario;

do $$
declare failures text;
begin
  select string_agg(scenario, ', ') into failures
  from ps413_results
  where expected_breed_points <> breed_points or expected_colour_points <> colour_points or expected_score <> score;
  if failures is not null then raise exception 'PS-413 matching cases failed: %', failures; end if;
end;
$$;

rollback;
