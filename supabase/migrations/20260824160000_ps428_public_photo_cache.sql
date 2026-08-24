-- PS-428: Public photo delivery stays behind the published-case boundary.
-- Only a non-sensitive version token reaches the public projection. Source and
-- derivative paths remain private Storage implementation details.

alter table public.pet_photos
  add column if not exists card_object_path text unique;

alter table public.pet_photos
  drop constraint if exists pet_photos_card_path_check;

alter table public.pet_photos
  add constraint pet_photos_card_path_check check (
    card_object_path is null
    or card_object_path ~ '^[0-9a-f-]{36}/card/[0-9a-f-]{36}\.jpg$'
  );

alter table public.public_missing_cases
  add column if not exists photo_version text;

create or replace function public.sync_public_missing_case(target_case_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  delete from public.public_missing_cases where case_id = target_case_id;

  insert into public.public_missing_cases (
    case_id, public_slug, title, last_seen_at, last_seen_description, published_at,
    pet_name, species, breed, colour, pet_description, public_latitude, public_longitude,
    photo_version
  )
  select
    c.id, c.public_slug, c.title, c.last_seen_at, c.last_seen_description, c.published_at,
    p.name, p.species, p.breed, p.colour, p.description,
    extensions.st_y(c.public_location), extensions.st_x(c.public_location),
    case when photo.id is null then null
      else photo.id::text || '-' || floor(extract(epoch from photo.processed_at))::bigint::text
    end
  from public.missing_cases c
  join public.pets p on p.id = c.pet_id
  left join lateral (
    select id, processed_at
    from public.pet_photos
    where pet_id = c.pet_id
      and status = 'processed'
      and display_object_path is not null
    order by processed_at desc
    limit 1
  ) photo on true
  where c.id = target_case_id
    and c.status = 'published';
end;
$$;

create or replace function public.sync_public_missing_cases_from_photo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_pet_id uuid := coalesce(new.pet_id, old.pet_id);
  matching_case record;
begin
  for matching_case in
    select id from public.missing_cases where pet_id = target_pet_id
  loop
    perform public.sync_public_missing_case(matching_case.id);
  end loop;
  return coalesce(new, old);
end;
$$;

drop trigger if exists pet_photos_sync_public_projection on public.pet_photos;
create trigger pet_photos_sync_public_projection
  after insert or update or delete on public.pet_photos
  for each row execute procedure public.sync_public_missing_cases_from_photo();

-- Refresh existing public cases after adding the derivative/version fields.
do $$
declare
  published_case record;
begin
  for published_case in select id from public.missing_cases where status = 'published'
  loop
    perform public.sync_public_missing_case(published_case.id);
  end loop;
end;
$$;

revoke all on function public.sync_public_missing_cases_from_photo() from public;

-- Nearby cards need the same safe version token as the detail view. Recreate
-- the RPC because PostgreSQL does not allow changing a function's OUT columns
-- in place.
drop function if exists public.find_public_nearby_cases(double precision, double precision, integer);

create function public.find_public_nearby_cases(
  search_latitude double precision,
  search_longitude double precision,
  search_radius_metres integer default 1609
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
  public_longitude double precision,
  photo_version text
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
    p.last_seen_description, p.published_at, p.public_latitude,
    p.public_longitude, p.photo_version
  from public.public_missing_cases p
  join public.missing_cases c on c.id = p.case_id
  cross join search_area s
  where search_latitude between -90 and 90
    and search_longitude between -180 and 180
    and extensions.st_dwithin(c.public_location::extensions.geography, s.point, s.radius_metres)
  order by extensions.st_distance(c.public_location::extensions.geography, s.point), p.published_at desc
  limit 12;
$$;

revoke all on function public.find_public_nearby_cases(double precision, double precision, integer) from public;
grant execute on function public.find_public_nearby_cases(double precision, double precision, integer) to anon, authenticated;
