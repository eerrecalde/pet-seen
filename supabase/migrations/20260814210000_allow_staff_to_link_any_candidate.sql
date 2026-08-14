-- PS-408: AI scores prioritise staff review but never replace a moderator's
-- judgement. Staff may link any case returned by the conservative shortlist.

create or replace function public.link_unlinked_sighting_to_case(target_sighting_id uuid, target_case_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_authorized_staff() then
    raise exception 'Only Pet Seen staff can link unlinked sightings';
  end if;

  if not exists (
    select 1 from public.unlinked_sighting_case_candidates(target_sighting_id)
    where case_id = target_case_id
  ) then
    raise exception 'That active case is not a matching candidate';
  end if;

  update public.sightings
  set case_id = target_case_id
  where id = target_sighting_id and case_id is null;
  if not found then raise exception 'This sighting is already linked or unavailable'; end if;

  insert into public.owner_email_notifications (sighting_id, recipient_id)
  select target_sighting_id, c.owner_id from public.missing_cases c where c.id = target_case_id
  on conflict (sighting_id) do nothing;
end;
$$;

create or replace function public.link_found_pet_report_to_case(target_report_id uuid, target_case_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare candidate record;
begin
  if not public.is_authorized_staff() then
    raise exception 'Only Pet Seen staff can link found-pet reports';
  end if;

  select * into candidate from public.found_pet_case_candidates(target_report_id) where case_id = target_case_id;
  if candidate.case_id is null then raise exception 'That active case is not a matching candidate'; end if;

  insert into public.found_pet_case_links (found_pet_report_id, case_id, match_score, match_reasons, linked_by)
  values (target_report_id, target_case_id, candidate.match_score, candidate.match_reasons, auth.uid())
  on conflict (found_pet_report_id, case_id) do update set
    match_score = excluded.match_score,
    match_reasons = excluded.match_reasons,
    linked_by = excluded.linked_by,
    linked_at = now();
end;
$$;
