-- PS-408: only a staff member can approve an unlinked sighting connection,
-- and only after a conservative, retained AI-assisted priority result.

create function public.link_unlinked_sighting_to_case(target_sighting_id uuid, target_case_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare score_record record;
begin
  if not public.is_authorized_staff() then
    raise exception 'Only Pet Seen staff can approve an AI-assisted sighting match';
  end if;

  select s.* into score_record
  from public.ai_unlinked_sighting_match_scores s
  join public.ai_unlinked_sighting_match_runs r on r.id = s.run_id
  where s.sighting_id = target_sighting_id and s.case_id = target_case_id
  order by r.created_at desc
  limit 1;
  if score_record.id is null or not score_record.priority_review then
    raise exception 'This sighting needs a high-confidence priority review result before it can be linked';
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

revoke all on function public.link_unlinked_sighting_to_case(uuid, uuid) from public;
grant execute on function public.link_unlinked_sighting_to_case(uuid, uuid) to authenticated;

-- Apply the same threshold to found-pet reports. An owner can only see a
-- provisional match after a staff member approves a retained priority result.
create or replace function public.link_found_pet_report_to_case(target_report_id uuid, target_case_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare candidate record;
begin
  if not public.is_authorized_staff() then
    raise exception 'Only Pet Seen staff can link found-pet reports';
  end if;
  select * into candidate from public.found_pet_case_candidates(target_report_id) where case_id = target_case_id;
  if candidate.case_id is null then raise exception 'That active case is not a matching candidate'; end if;
  if not exists (
    select 1 from public.ai_found_pet_match_scores s
    join public.ai_found_pet_match_runs r on r.id = s.run_id
    where s.found_pet_report_id = target_report_id and s.case_id = target_case_id and s.priority_review
    order by r.created_at desc limit 1
  ) then raise exception 'This report needs a high-confidence priority review result before it can be linked'; end if;
  insert into public.found_pet_case_links (found_pet_report_id, case_id, match_score, match_reasons, linked_by)
  values (target_report_id, target_case_id, candidate.match_score, candidate.match_reasons, auth.uid())
  on conflict (found_pet_report_id, case_id) do update set case_id = excluded.case_id, match_score = excluded.match_score, match_reasons = excluded.match_reasons, linked_by = excluded.linked_by, linked_at = now();
end;
$$;
