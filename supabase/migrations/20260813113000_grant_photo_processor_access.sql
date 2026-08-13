-- The process-pet-photo Edge Function uses the service role to read the
-- just-created record and persist its processing result. Bypass RLS does not
-- grant ordinary table privileges, so these grants are required as well.
grant select, update on table public.pet_photos to service_role;
