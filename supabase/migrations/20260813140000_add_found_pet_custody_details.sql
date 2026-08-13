-- PS-402 follow-up: record hand-off or last-known-custody details privately.

alter table public.found_pet_reports
  add column custody_details text check (char_length(trim(custody_details)) <= 1500);

drop function public.submit_found_pet_report(public.pet_species, text, text, text, public.found_pet_custody_status, double precision, double precision, timestamptz, text, uuid);

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
  custody_information text,
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
    location_description, custody_details, client_submission_id
  ) values (
    found_species, nullif(trim(found_breed), ''), nullif(trim(found_colour), ''), trim(found_details),
    found_custody_status, extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326),
    found_time, nullif(trim(place_description), ''), nullif(trim(custody_information), ''), submission_token
  ) returning id into report_id;

  return report_id;
end;
$$;

revoke all on function public.submit_found_pet_report(public.pet_species, text, text, text, public.found_pet_custody_status, double precision, double precision, timestamptz, text, text, uuid) from public;
grant execute on function public.submit_found_pet_report(public.pet_species, text, text, text, public.found_pet_custody_status, double precision, double precision, timestamptz, text, text, uuid) to anon, authenticated;
