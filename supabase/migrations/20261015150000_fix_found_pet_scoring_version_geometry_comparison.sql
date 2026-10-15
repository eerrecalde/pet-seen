-- A lifecycle-only update must not requeue AI scoring. Comparing geometry values
-- through a record tuple is ambiguous on hosted PostGIS, so compare a stable
-- binary representation instead.
create or replace function public.bump_found_pet_ai_scoring_version()
returns trigger language plpgsql as $$
begin
  if old.species is distinct from new.species
    or old.breed is distinct from new.breed
    or old.colour is distinct from new.colour
    or old.details is distinct from new.details
    or old.found_at is distinct from new.found_at
    or extensions.st_asewkb(old.exact_location)
      is distinct from extensions.st_asewkb(new.exact_location)
  then
    new.ai_scoring_version := old.ai_scoring_version + 1;
  end if;
  return new;
end $$;
