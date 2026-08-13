-- PS-411: found-pet reports are quarantined until staff approve them. Automated
-- checks only identify risk; they never make content visible without a review.

create type public.found_pet_moderation_status as enum ('pending', 'approved', 'rejected');

alter table public.found_pet_reports
  add column moderation_status public.found_pet_moderation_status not null default 'pending',
  add column automated_screening_note text,
  add column moderated_at timestamptz,
  add column moderated_by uuid references auth.users (id) on delete set null,
  add constraint found_pet_reports_moderation_check check (
    (moderation_status = 'pending' and moderated_at is null and moderated_by is null)
    or (moderation_status in ('approved', 'rejected') and moderated_at is not null and moderated_by is not null)
  );

create index found_pet_reports_moderation_created_at_idx
  on public.found_pet_reports (moderation_status, created_at desc);

create table public.found_pet_report_moderation_audit (
  id bigint generated always as identity primary key,
  -- Intentionally not a foreign key: rejected reports are deleted, while this
  -- UUID and decision metadata remain as the minimal operational audit trail.
  found_pet_report_id uuid not null,
  event text not null check (event in ('submitted_for_review', 'approved', 'rejected', 'rejected_files_deleted')),
  actor_id uuid references auth.users (id) on delete set null,
  automated_screening_note text,
  created_at timestamptz not null default now()
);

create index found_pet_report_moderation_audit_report_created_idx
  on public.found_pet_report_moderation_audit (found_pet_report_id, created_at desc);

alter table public.found_pet_report_moderation_audit enable row level security;
revoke all on public.found_pet_report_moderation_audit from anon, authenticated;
create policy "Staff can read found-pet moderation audit"
  on public.found_pet_report_moderation_audit for select to authenticated
  using ((select public.is_authorized_staff()));

create function public.found_pet_automated_screening_note(content text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when coalesce(content, '') ~* '(wire transfer|gift card|crypto|bitcoin|western union|cashapp|pay ?pal.*(fee|deposit)|verification code|send.*money)' then 'potential scam or payment request'
    when coalesce(content, '') ~* '(kill yourself|racial slur|sexual services|escort|porn)' then 'potential abusive or unsafe language'
    when coalesce(content, '') ~* '(buy followers|seo services|click here|free iphone)' then 'potential irrelevant promotional content'
    else null
  end;
$$;

create function public.audit_found_pet_report_submission()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.automated_screening_note := public.found_pet_automated_screening_note(concat_ws(' ', new.breed, new.colour, new.details, new.location_description, new.custody_details));
  return new;
end;
$$;

create trigger found_pet_reports_screen_before_insert
  before insert on public.found_pet_reports
  for each row execute procedure public.audit_found_pet_report_submission();

create function public.record_found_pet_report_submission_audit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into public.found_pet_report_moderation_audit (found_pet_report_id, event, automated_screening_note)
  values (new.id, 'submitted_for_review', new.automated_screening_note);
  return new;
end;
$$;

create trigger found_pet_reports_audit_after_insert
  after insert on public.found_pet_reports
  for each row execute procedure public.record_found_pet_report_submission_audit();

create function public.review_found_pet_report(target_report_id uuid, decision public.found_pet_moderation_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if decision not in ('approved', 'rejected') then
    raise exception 'Choose approve or reject';
  end if;
  if not public.is_authorized_staff() then
    raise exception 'Only Pet Seen staff can moderate found-pet reports';
  end if;

  update public.found_pet_reports
  set moderation_status = decision, moderated_at = now(), moderated_by = auth.uid()
  where id = target_report_id and moderation_status = 'pending';
  if not found then raise exception 'This report is no longer awaiting review'; end if;

  insert into public.found_pet_report_moderation_audit (found_pet_report_id, event, actor_id)
  values (target_report_id, decision::text, auth.uid());
end;
$$;

create policy "Linked owners can read approved found-pet reports"
  on public.found_pet_reports for select to authenticated
  using (
    moderation_status = 'approved'
    and exists (
      select 1 from public.found_pet_case_links l
      join public.missing_cases c on c.id = l.case_id
      where l.found_pet_report_id = found_pet_reports.id and c.owner_id = (select auth.uid())
    )
  );

create policy "Linked owners can read approved found-pet photos"
  on public.found_pet_photos for select to authenticated
  using (exists (
    select 1 from public.found_pet_reports r
    join public.found_pet_case_links l on l.found_pet_report_id = r.id
    join public.missing_cases c on c.id = l.case_id
    where r.id = found_pet_photos.found_pet_report_id
      and r.moderation_status = 'approved'
      and c.owner_id = (select auth.uid())
  ));

create policy "Staff can read found-pet photo files"
  on storage.objects for select to authenticated
  using (bucket_id = 'found-pet-photos' and (select public.is_authorized_staff()));

create policy "Linked owners can read approved found-pet photo files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'found-pet-photos'
    and exists (
      select 1 from public.found_pet_photos p
      join public.found_pet_reports r on r.id = p.found_pet_report_id
      join public.found_pet_case_links l on l.found_pet_report_id = r.id
      join public.missing_cases c on c.id = l.case_id
      where (p.source_object_path = storage.objects.name or p.display_object_path = storage.objects.name)
        and r.moderation_status = 'approved'
        and c.owner_id = (select auth.uid())
    )
  );

-- Matching and owner hand-off are unavailable until a human moderator approves the report.
create or replace function public.found_pet_case_candidates(target_report_id uuid)
returns table (case_id uuid, public_slug text, pet_name text, breed text, colour text, last_seen_at timestamptz, distance_km numeric, match_score smallint, match_reasons text[])
language sql security definer set search_path = public, extensions as $$
  with report as (
    select * from public.found_pet_reports
    where id = target_report_id and moderation_status = 'approved' and public.is_authorized_staff()
  ), candidates as (
    select c.id candidate_case_id, c.public_slug, p.name candidate_pet_name, p.breed candidate_breed, p.colour candidate_colour, c.last_seen_at,
      extensions.st_distance(r.exact_location::extensions.geography, c.exact_location::extensions.geography) / 1000 candidate_distance_km,
      r.found_at, r.breed report_breed, r.colour report_colour
    from report r join public.missing_cases c on c.status = 'published' and c.exact_location is not null
    join public.pets p on p.id = c.pet_id and p.species = r.species
    where extensions.st_dwithin(r.exact_location::extensions.geography, c.exact_location::extensions.geography, 30000)
  ), scored as (
    select *, 35 + case when candidate_distance_km <= 2 then 30 when candidate_distance_km <= 10 then 15 when candidate_distance_km <= 30 then 5 else 0 end
      + case when last_seen_at is not null and found_at >= last_seen_at and found_at - last_seen_at <= interval '2 days' then 20 when last_seen_at is not null and found_at >= last_seen_at and found_at - last_seen_at <= interval '7 days' then 12 when last_seen_at is not null and found_at >= last_seen_at and found_at - last_seen_at <= interval '30 days' then 6 else 0 end
      + case when nullif(lower(trim(report_breed)), '') is not null and lower(trim(report_breed)) = lower(trim(candidate_breed)) then 10 else 0 end
      + case when nullif(lower(trim(report_colour)), '') is not null and lower(trim(report_colour)) = lower(trim(candidate_colour)) then 5 else 0 end score from candidates
  ) select candidate_case_id, public_slug, candidate_pet_name, candidate_breed, candidate_colour, last_seen_at, round(candidate_distance_km::numeric, 1), least(score, 100)::smallint,
    array_remove(array['Same species', case when candidate_distance_km <= 2 then 'Found within 2 km' when candidate_distance_km <= 10 then 'Found within 10 km' when candidate_distance_km <= 30 then 'Found within 30 km' end, case when last_seen_at is not null and found_at >= last_seen_at and found_at - last_seen_at <= interval '2 days' then 'Reported within 2 days of last seen' when last_seen_at is not null and found_at >= last_seen_at and found_at - last_seen_at <= interval '7 days' then 'Reported within 7 days of last seen' when last_seen_at is not null and found_at >= last_seen_at and found_at - last_seen_at <= interval '30 days' then 'Reported within 30 days of last seen' end, case when nullif(lower(trim(report_breed)), '') is not null and lower(trim(report_breed)) = lower(trim(candidate_breed)) then 'Matching breed' end, case when nullif(lower(trim(report_colour)), '') is not null and lower(trim(report_colour)) = lower(trim(candidate_colour)) then 'Matching markings' end], null)
  from scored order by score desc, candidate_distance_km asc, last_seen_at desc nulls last limit 5;
$$;

revoke all on function public.found_pet_automated_screening_note(text), public.review_found_pet_report(uuid, public.found_pet_moderation_status) from public;
grant execute on function public.review_found_pet_report(uuid, public.found_pet_moderation_status) to authenticated;
