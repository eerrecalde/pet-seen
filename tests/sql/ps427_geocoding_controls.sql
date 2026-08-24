-- PS-427 regression contract for the server-owned geocoding cache and limits.
-- Run with: docker exec -i supabase_db_pet-seen psql -v ON_ERROR_STOP=1 -U postgres -d postgres < tests/sql/ps427_geocoding_controls.sql

begin;

do $$
declare
  requester text := md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text);
  attempt integer;
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);
  insert into public.geocoding_query_cache (normalized_query, results, expires_at)
  values ('sw1a 1aa', '[{"label":"SW1A 1AA","latitude":51.5,"longitude":-0.1}]'::jsonb, now() + interval '1 day');
  if not exists (
    select 1 from public.geocoding_query_cache
    where normalized_query = regexp_replace(lower(trim('  SW1A   1AA  ')), '[[:space:]]+', ' ', 'g')
      and expires_at > now()
  ) then
    raise exception 'PS-427 normalised geocoding cache lookup is missing';
  end if;

  for attempt in 1..20 loop
    if not public.take_geocoding_request_slot(requester) then
      raise exception 'PS-427 rejected request % before the per-client cap', attempt;
    end if;
  end loop;
  if public.take_geocoding_request_slot(requester) then
    raise exception 'PS-427 did not enforce the per-client provider-call cap';
  end if;
end;
$$;

rollback;
