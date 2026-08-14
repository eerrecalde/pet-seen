-- The local-only dev-auth-bypass Edge Function uses the service role to
-- assign a test user's staff role. The function itself refuses deployed and
-- non-local requests; this grant does not expose role assignments to clients.
grant select, insert, delete on table public.user_roles to service_role;
