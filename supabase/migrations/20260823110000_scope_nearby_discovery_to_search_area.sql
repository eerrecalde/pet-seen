-- PS-303 maintenance: discovery begins with a location chosen by the visitor.
-- These RPCs only return persisted public-safe coordinates and cap each result
-- set, so the browser never downloads a national feed or unbounded map pins.

create index if not exists missing_cases_public_location_geography_gix
  on public.missing_cases using gist ((public_location::extensions.geography))
  where status = 'published' and public_location is not null;

create index if not exists sightings_public_location_geography_gix
  on public.sightings using gist ((public_location::extensions.geography))
  where report_status = 'confirmed' and public_location is not null;

create or replace function public.find_public_nearby_cases(
  search_latitude double precision,
  search_longitude double precision,
  search_radius_metres integer default 16093
)
returns table (
  public_slug text,
  pet_name text,
  species public.pet_species,
  breed text,
  colour text,
  last_seen_description text,
  published_at timestamptz,
  public_latitude double precision,
  public_longitude double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with search_area as (
    select extensions.st_setsrid(
      extensions.st_makepoint(search_longitude, search_latitude), 4326
    )::extensions.geography as point,
    least(greatest(search_radius_metres, 1000), 50000) as radius_metres
  )
  select p.public_slug, p.pet_name, p.species, p.breed, p.colour,
    p.last_seen_description, p.published_at, p.public_latitude, p.public_longitude
  from public.public_missing_cases p
  join public.missing_cases c on c.id = p.case_id
  cross join search_area s
  where search_latitude between -90 and 90
    and search_longitude between -180 and 180
    and extensions.st_dwithin(c.public_location::extensions.geography, s.point, s.radius_metres)
  order by extensions.st_distance(c.public_location::extensions.geography, s.point), p.published_at desc
  limit 12;
$$;

create or replace function public.find_public_nearby_sightings(
  search_latitude double precision,
  search_longitude double precision,
  search_radius_metres integer default 16093
)
returns table (
  sighting_id uuid,
  public_latitude double precision,
  public_longitude double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with search_area as (
    select extensions.st_setsrid(
      extensions.st_makepoint(search_longitude, search_latitude), 4326
    )::extensions.geography as point,
    least(greatest(search_radius_metres, 1000), 50000) as radius_metres
  )
  select p.sighting_id, p.public_latitude, p.public_longitude
  from public.public_nearby_sightings p
  join public.sightings s on s.id = p.sighting_id
  cross join search_area a
  where search_latitude between -90 and 90
    and search_longitude between -180 and 180
    and extensions.st_dwithin(s.public_location::extensions.geography, a.point, a.radius_metres)
  order by extensions.st_distance(s.public_location::extensions.geography, a.point), p.seen_at desc
  limit 24;
$$;

revoke all on function public.find_public_nearby_cases(double precision, double precision, integer) from public;
revoke all on function public.find_public_nearby_sightings(double precision, double precision, integer) from public;
grant execute on function public.find_public_nearby_cases(double precision, double precision, integer) to anon, authenticated;
grant execute on function public.find_public_nearby_sightings(double precision, double precision, integer) to anon, authenticated;
