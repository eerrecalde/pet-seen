-- PS-427: keep provider-backed place search behind the Edge Function boundary.
-- Cached results are deliberately short lived and contain only public provider
-- data; report coordinates continue to be stored only by the submission RPCs.

create table public.geocoding_query_cache (
  normalized_query text primary key check (char_length(normalized_query) between 3 and 200),
  results jsonb not null default '[]'::jsonb,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index geocoding_query_cache_expires_idx
  on public.geocoding_query_cache (expires_at);

create table public.geocoding_request_attempts (
  requester_key text not null,
  requested_at timestamptz not null default now()
);

create index geocoding_request_attempts_requester_idx
  on public.geocoding_request_attempts (requester_key, requested_at desc);
create index geocoding_request_attempts_global_idx
  on public.geocoding_request_attempts (requested_at desc);

alter table public.geocoding_query_cache enable row level security;
alter table public.geocoding_request_attempts enable row level security;
revoke all on public.geocoding_query_cache, public.geocoding_request_attempts from anon, authenticated;

-- Allows 20 uncached searches from one browser/network in five minutes and
-- 300 provider calls globally in the same window. Returning false is a normal
-- capacity response, not an exception the public function should expose.
create function public.take_geocoding_request_slot(p_requester_key text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  if p_requester_key is null or char_length(p_requester_key) <> 64 then
    raise exception 'Invalid requester key';
  end if;

  perform pg_advisory_xact_lock(hashtext('petseen-geocoding-global'));
  perform pg_advisory_xact_lock(hashtext(p_requester_key));
  delete from public.geocoding_request_attempts
    where requested_at < now() - interval '5 minutes';

  if (select count(*) from public.geocoding_request_attempts) >= 300
     or (select count(*) from public.geocoding_request_attempts where geocoding_request_attempts.requester_key = p_requester_key) >= 20 then
    return false;
  end if;

  insert into public.geocoding_request_attempts (requester_key) values (p_requester_key);
  return true;
end;
$$;

revoke all on function public.take_geocoding_request_slot(text) from public;
grant execute on function public.take_geocoding_request_slot(text) to service_role;
