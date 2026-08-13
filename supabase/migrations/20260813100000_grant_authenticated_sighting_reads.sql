-- The owner_case_sightings view is security-invoker, so its RLS policy on
-- sightings must be paired with the ordinary table privilege.
grant select on table public.sightings to authenticated;
