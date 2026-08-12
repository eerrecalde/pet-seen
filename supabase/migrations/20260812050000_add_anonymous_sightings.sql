-- PS-201–203: anonymous reports are accepted through a narrowly scoped RPC.
-- Exact sighting positions never have an anonymous read policy.

create table public.sightings (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.missing_cases (id) on delete set null,
  exact_location extensions.geometry(Point, 4326) not null,
  seen_at timestamptz not null default now(),
  location_description text check (char_length(trim(location_description)) <= 1500),
  details text check (char_length(trim(details)) between 1 and 1500),
  created_at timestamptz not null default now(),
  constraint sightings_seen_at_check check (seen_at <= now() + interval '5 minutes')
);

create index sightings_case_seen_at_idx on public.sightings (case_id, seen_at desc);
create index sightings_exact_location_gix on public.sightings using gist (exact_location);

alter table public.sightings enable row level security;
revoke all on table public.sightings from anon, authenticated;

create policy "Case owners and staff can read sightings"
  on public.sightings for select to authenticated
  using (
    (select public.is_authorized_staff())
    or exists (
      select 1 from public.missing_cases c
      where c.id = sightings.case_id and c.owner_id = (select auth.uid())
    )
  );

-- The view turns private geometry into coordinates only after the base-table
-- policy above has established that the caller owns the linked case (or is staff).
create view public.owner_case_sightings
with (security_invoker = true)
as
  select
    id, case_id, seen_at, location_description, details, created_at,
    extensions.st_y(exact_location) as latitude,
    extensions.st_x(exact_location) as longitude
  from public.sightings;

grant select on public.owner_case_sightings to authenticated;

create function public.submit_sighting(
  selected_case_slug text,
  latitude double precision,
  longitude double precision,
  sighted_at timestamptz,
  place_description text,
  sighting_details text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  linked_case_id uuid;
  sighting_id uuid;
begin
  if latitude not between -90 and 90 or longitude not between -180 and 180 then
    raise exception 'Enter a valid latitude and longitude';
  end if;

  if sighted_at is null or sighted_at > now() + interval '5 minutes' then
    raise exception 'Enter a valid sighting time';
  end if;

  if nullif(trim(sighting_details), '') is null then
    raise exception 'Add a short description of what you saw';
  end if;

  if selected_case_slug is not null and selected_case_slug <> '' then
    select case_id into linked_case_id
    from public.public_missing_cases
    where public_slug = selected_case_slug;
    if linked_case_id is null then
      raise exception 'That missing-pet case is no longer available';
    end if;
  end if;

  insert into public.sightings (case_id, exact_location, seen_at, location_description, details)
  values (
    linked_case_id,
    extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326),
    sighted_at,
    nullif(trim(place_description), ''),
    trim(sighting_details)
  )
  returning id into sighting_id;

  return sighting_id;
end;
$$;

revoke all on function public.submit_sighting(text, double precision, double precision, timestamptz, text, text) from public;
grant execute on function public.submit_sighting(text, double precision, double precision, timestamptz, text, text) to anon, authenticated;
