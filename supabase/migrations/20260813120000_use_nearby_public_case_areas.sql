-- PS-107: public missing-case locations should be useful nearby search areas,
-- not a distant grid point. The true point is randomly positioned within the
-- persisted 100 m-wide public circle, so public reads stay stable and do
-- not reveal the exact last-seen coordinate.

create or replace function public.set_case_public_location()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  offset_angle double precision;
  offset_distance double precision;
begin
  if new.exact_location is null then
    new.public_location = null;
  else
    -- EPSG:3857 uses metre-based coordinates. Square-root sampling distributes
    -- the generated centre uniformly across a 50 m radius, placing the true
    -- point somewhere in the displayed 100 m-wide search circle.
    offset_angle = random() * 2 * pi();
    offset_distance = sqrt(random()) * 50;
    new.public_location = extensions.st_transform(
      extensions.st_translate(
        extensions.st_transform(new.exact_location, 3857),
        cos(offset_angle) * offset_distance,
        sin(offset_angle) * offset_distance
      ),
      4326
    )::extensions.geometry(Point, 4326);
  end if;
  return new;
end;
$$;

-- Regenerate persisted public areas and the anonymous projection for existing
-- published cases. Updating the exact geometry invokes the server-side trigger.
update public.missing_cases
set exact_location = exact_location
where exact_location is not null;

revoke all on function public.set_case_public_location() from public;
