-- PS-404: a reporter may opt in to a private, magic-link protected follow-up.
-- Their address is never exposed to the matched case owner.

alter table public.found_pet_reports
  add column reporter_email text,
  add column reporter_id uuid references auth.users (id) on delete set null,
  add constraint found_pet_reports_reporter_email_check check (
    reporter_email is null or reporter_email = lower(trim(reporter_email))
      and reporter_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  );

create index found_pet_reports_reporter_id_idx on public.found_pet_reports (reporter_id)
  where reporter_id is not null;

alter table public.found_pet_reports
  add constraint found_pet_reports_reporter_identity_check check (
    reporter_id is null or reporter_email is not null
  );

create table public.found_pet_messages (
  id uuid primary key default gen_random_uuid(),
  found_pet_report_id uuid not null references public.found_pet_reports (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete restrict,
  body text not null check (char_length(trim(body)) between 1 and 1500),
  created_at timestamptz not null default now()
);

create index found_pet_messages_report_created_idx on public.found_pet_messages (found_pet_report_id, created_at);
alter table public.found_pet_messages enable row level security;
revoke all on public.found_pet_messages from anon, authenticated;

create function public.can_access_found_pet_conversation(target_report_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.found_pet_reports r
    join public.found_pet_case_links l on l.found_pet_report_id = r.id and l.status = 'confirmed'
    join public.missing_cases c on c.id = l.case_id
    where r.id = target_report_id
      and r.reporter_id is not null
      and (r.reporter_id = auth.uid() or c.owner_id = auth.uid())
  );
$$;

create policy "Reporter can read their found pet reports"
  on public.found_pet_reports for select to authenticated
  using (reporter_id = auth.uid());

create policy "Conversation participants can read messages"
  on public.found_pet_messages for select to authenticated
  using (public.can_access_found_pet_conversation(found_pet_report_id));

create function public.claim_found_pet_reporter_access()
returns integer language plpgsql security definer set search_path = public as $$
declare claimed_count integer;
begin
  if auth.uid() is null or nullif(auth.jwt() ->> 'email', '') is null then
    raise exception 'Sign in with the email used for the report';
  end if;
  update public.found_pet_reports
  set reporter_id = auth.uid()
  where reporter_email = lower(auth.jwt() ->> 'email')
    and (reporter_id is null or reporter_id = auth.uid());
  get diagnostics claimed_count = row_count;
  return claimed_count;
end;
$$;

create function public.send_found_pet_message(target_report_id uuid, message_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare message_id uuid;
begin
  if not public.can_access_found_pet_conversation(target_report_id) then
    raise exception 'This private conversation is not available';
  end if;
  insert into public.found_pet_messages (found_pet_report_id, sender_id, body)
  values (target_report_id, auth.uid(), trim(message_body)) returning id into message_id;
  return message_id;
end;
$$;

revoke all on function public.can_access_found_pet_conversation(uuid), public.claim_found_pet_reporter_access(), public.send_found_pet_message(uuid, text) from public;
grant execute on function public.claim_found_pet_reporter_access(), public.send_found_pet_message(uuid, text) to authenticated;
grant select on public.found_pet_messages to authenticated;

drop function public.submit_found_pet_report(public.pet_species, text, text, text, public.found_pet_custody_status, double precision, double precision, timestamptz, text, text, uuid);
create function public.submit_found_pet_report(
  found_species public.pet_species, found_breed text, found_colour text, found_details text,
  found_custody_status public.found_pet_custody_status, latitude double precision, longitude double precision,
  found_time timestamptz, place_description text, custody_information text, submission_token uuid,
  follow_up_email text default null
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare report_id uuid; rate_key text; normalized_email text;
begin
  if latitude not between -90 and 90 or longitude not between -180 and 180 then raise exception 'Enter a valid found location'; end if;
  if found_time is null or found_time > now() + interval '5 minutes' then raise exception 'Enter a valid found time'; end if;
  if nullif(trim(found_details), '') is null then raise exception 'Add a short description of the pet'; end if;
  if submission_token is null then raise exception 'A submission token is required'; end if;
  normalized_email := nullif(lower(trim(follow_up_email)), '');
  if normalized_email is not null and normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Enter a valid email address'; end if;
  select id into report_id from public.found_pet_reports where client_submission_id = submission_token;
  if report_id is not null then return report_id; end if;
  rate_key := md5(coalesce(auth.uid()::text, nullif(split_part((nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for'), ',', 1), ''), nullif(current_setting('request.headers', true), ''), 'anonymous'));
  perform pg_advisory_xact_lock(hashtext(rate_key));
  delete from public.found_pet_report_submission_attempts where requester_key = rate_key and submitted_at < now() - interval '15 minutes';
  if (select count(*) from public.found_pet_report_submission_attempts where requester_key = rate_key) >= 5 then raise exception 'Too many found-pet reports. Please try again in 15 minutes.'; end if;
  insert into public.found_pet_report_submission_attempts (requester_key) values (rate_key);
  insert into public.found_pet_reports (species, breed, colour, details, custody_status, exact_location, found_at, location_description, custody_details, client_submission_id, reporter_email)
  values (found_species, nullif(trim(found_breed), ''), nullif(trim(found_colour), ''), trim(found_details), found_custody_status, extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326), found_time, nullif(trim(place_description), ''), nullif(trim(custody_information), ''), submission_token, normalized_email)
  returning id into report_id;
  return report_id;
end;
$$;
revoke all on function public.submit_found_pet_report(public.pet_species, text, text, text, public.found_pet_custody_status, double precision, double precision, timestamptz, text, text, uuid, text) from public;
grant execute on function public.submit_found_pet_report(public.pet_species, text, text, text, public.found_pet_custody_status, double precision, double precision, timestamptz, text, text, uuid, text) to anon, authenticated;
