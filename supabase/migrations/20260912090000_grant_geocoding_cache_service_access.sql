-- The Edge Function reads and refreshes this public-provider cache using its
-- server-side Supabase client. Service role access must be explicit because
-- table grants are evaluated before RLS bypass.
grant select, insert, update on table public.geocoding_query_cache to service_role;
