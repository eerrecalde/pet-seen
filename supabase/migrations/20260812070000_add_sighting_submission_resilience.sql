-- PS-207: throttle anonymous reports and make client retries idempotent.
alter table public.sightings
  add column client_submission_id uuid unique;

create table public.sighting_submission_attempts (
  requester_key text not null,
  submitted_at timestamptz not null default now()
);

create index sighting_submission_attempts_requester_submitted_idx
  on public.sighting_submission_attempts (requester_key, submitted_at desc);

alter table public.sighting_submission_attempts enable row level security;
revoke all on table public.sighting_submission_attempts from public;

drop function public.submit_sighting(text, double precision, double precision, timestamptz, text, text);

create function public.submit_sighting(
  selected_case_slug text,
  latitude double precision,
  longitude double precision,
  sighted_at timestamptz,
  place_description text,
  sighting_details text,
  submission_token uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  linked_case_id uuid;
  sighting_id uuid;
  rate_key text;
begin
  if latitude not between -90 and 90 or longitude not between -180 and 180 then
    raise exception 'Enter a valid latitude and longitude';
  end if;

  if sighted_at is null or sighted_at > now() + interval '5 minutes' then
    raise exception 'Enter a valid sighting time';
  end if;

  if nullif(trim(sighting_details), '') is null then
    raise exception 'Add a short description of what you saw';
  end if;

  if submission_token is null then
    raise exception 'A submission token is required';
  end if;

  -- A retry after a lost network response must return the original report,
  -- not create a duplicate or consume another rate-limit slot.
  select id into sighting_id from public.sightings where client_submission_id = submission_token;
  if sighting_id is not null then return sighting_id; end if;

  rate_key := coalesce(
    auth.uid()::text,
    nullif(split_part((nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for'), ',', 1), ''),
    nullif(current_setting('request.headers', true), ''),
    'anonymous'
  );
  rate_key := md5(rate_key);
  perform pg_advisory_xact_lock(hashtext(rate_key));
  delete from public.sighting_submission_attempts
  where requester_key = rate_key and submitted_at < now() - interval '15 minutes';

  if (select count(*) from public.sighting_submission_attempts where requester_key = rate_key) >= 5 then
    raise exception 'Too many sighting reports. Please try again in 15 minutes.';
  end if;

  if selected_case_slug is not null and selected_case_slug <> '' then
    select case_id into linked_case_id
    from public.public_missing_cases
    where public_slug = selected_case_slug;
    if linked_case_id is null then
      raise exception 'That missing-pet case is no longer available';
    end if;
  end if;

  insert into public.sighting_submission_attempts (requester_key) values (rate_key);
  insert into public.sightings (case_id, exact_location, seen_at, location_description, details, client_submission_id)
  values (
    linked_case_id,
    extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326),
    sighted_at,
    nullif(trim(place_description), ''),
    trim(sighting_details),
    submission_token
  )
  returning id into sighting_id;

  return sighting_id;
end;
$$;

revoke all on function public.submit_sighting(text, double precision, double precision, timestamptz, text, text, uuid) from public;
grant execute on function public.submit_sighting(text, double precision, double precision, timestamptz, text, text, uuid) to anon, authenticated;
