-- The scoring Edge Function invokes this helper with the service role after
-- persisting its score rows. It remains unavailable to public callers.
grant execute on function public.create_provisional_found_pet_match(uuid) to service_role;
