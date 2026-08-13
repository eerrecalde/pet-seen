-- PS-402: private found-pet reports. Matching, public discovery and direct
-- reporter follow-up are intentionally delivered in later tasks.

create type public.found_pet_custody_status as enum (
  'with_reporter',
  'with_vet_or_rescue',
  'not_in_custody'
);

create table public.found_pet_reports (
  id uuid primary key default gen_random_uuid(),
  species public.pet_species not null,
  breed text check (char_length(trim(breed)) <= 120),
  colour text check (char_length(trim(colour)) <= 120),
  details text not null check (char_length(trim(details)) between 1 and 1500),
  custody_status public.found_pet_custody_status not null,
  exact_location extensions.geometry(Point, 4326) not null,
  found_at timestamptz not null default now(),
  location_description text check (char_length(trim(location_description)) <= 1500),
  client_submission_id uuid not null unique,
  created_at timestamptz not null default now(),
  constraint found_pet_reports_found_at_check check (found_at <= now() + interval '5 minutes')
);

create index found_pet_reports_exact_location_gix on public.found_pet_reports using gist (exact_location);
create index found_pet_reports_custody_found_at_idx on public.found_pet_reports (custody_status, found_at desc);

alter table public.found_pet_reports enable row level security;
revoke all on table public.found_pet_reports from anon, authenticated;

create policy "Staff can read found pet reports"
  on public.found_pet_reports for select to authenticated
  using ((select public.is_authorized_staff()));

create table public.found_pet_report_submission_attempts (
  requester_key text not null,
  submitted_at timestamptz not null default now()
);

create index found_pet_report_attempts_requester_submitted_idx
  on public.found_pet_report_submission_attempts (requester_key, submitted_at desc);

alter table public.found_pet_report_submission_attempts enable row level security;
revoke all on table public.found_pet_report_submission_attempts from public;

create function public.submit_found_pet_report(
  found_species public.pet_species,
  found_breed text,
  found_colour text,
  found_details text,
  found_custody_status public.found_pet_custody_status,
  latitude double precision,
  longitude double precision,
  found_time timestamptz,
  place_description text,
  submission_token uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  report_id uuid;
  rate_key text;
begin
  if latitude not between -90 and 90 or longitude not between -180 and 180 then
    raise exception 'Enter a valid found location';
  end if;
  if found_time is null or found_time > now() + interval '5 minutes' then
    raise exception 'Enter a valid found time';
  end if;
  if nullif(trim(found_details), '') is null then
    raise exception 'Add a short description of the pet';
  end if;
  if submission_token is null then
    raise exception 'A submission token is required';
  end if;

  select id into report_id from public.found_pet_reports where client_submission_id = submission_token;
  if report_id is not null then return report_id; end if;

  rate_key := md5(coalesce(
    auth.uid()::text,
    nullif(split_part((nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for'), ',', 1), ''),
    nullif(current_setting('request.headers', true), ''),
    'anonymous'
  ));
  perform pg_advisory_xact_lock(hashtext(rate_key));
  delete from public.found_pet_report_submission_attempts
  where requester_key = rate_key and submitted_at < now() - interval '15 minutes';
  if (select count(*) from public.found_pet_report_submission_attempts where requester_key = rate_key) >= 5 then
    raise exception 'Too many found-pet reports. Please try again in 15 minutes.';
  end if;

  insert into public.found_pet_report_submission_attempts (requester_key) values (rate_key);
  insert into public.found_pet_reports (
    species, breed, colour, details, custody_status, exact_location, found_at,
    location_description, client_submission_id
  ) values (
    found_species, nullif(trim(found_breed), ''), nullif(trim(found_colour), ''), trim(found_details),
    found_custody_status, extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326),
    found_time, nullif(trim(place_description), ''), submission_token
  ) returning id into report_id;

  return report_id;
end;
$$;

revoke all on function public.submit_found_pet_report(public.pet_species, text, text, text, public.found_pet_custody_status, double precision, double precision, timestamptz, text, uuid) from public;
grant execute on function public.submit_found_pet_report(public.pet_species, text, text, text, public.found_pet_custody_status, double precision, double precision, timestamptz, text, uuid) to anon, authenticated;
