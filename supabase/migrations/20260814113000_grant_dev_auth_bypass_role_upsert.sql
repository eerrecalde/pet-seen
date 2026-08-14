-- Allow the local-only dev-auth-bypass Edge Function to make repeat role
-- assignments idempotent when the selected test role is already present.
grant update on table public.user_roles to service_role;
