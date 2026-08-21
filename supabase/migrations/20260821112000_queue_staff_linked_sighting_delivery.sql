-- Staff linking is also a server-owned workflow: do not depend on the
-- moderator's browser remaining open long enough to send the owner email.
create or replace function public.link_unlinked_sighting_to_case(target_sighting_id uuid, target_case_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare score_record record;
begin
  if not public.is_authorized_staff() then
    raise exception 'Only Pet Seen staff can approve an AI-assisted sighting match';
  end if;
  select s.* into score_record from public.ai_unlinked_sighting_match_scores s
  join public.ai_unlinked_sighting_match_runs r on r.id = s.run_id
  where s.sighting_id = target_sighting_id and s.case_id = target_case_id
  order by r.created_at desc limit 1;
  if score_record.id is null or not score_record.priority_review then
    raise exception 'This sighting needs a high-confidence priority review result before it can be linked';
  end if;
  update public.sightings set case_id = target_case_id where id = target_sighting_id and case_id is null;
  if not found then raise exception 'This sighting is already linked or unavailable'; end if;
  insert into public.owner_email_notifications (sighting_id, recipient_id)
  select target_sighting_id, c.owner_id from public.missing_cases c where c.id = target_case_id
  on conflict (sighting_id) do nothing;
  insert into public.workflow_outbox (kind, aggregate_id) values ('owner_sighting_email', target_sighting_id)
  on conflict (kind, aggregate_id) do nothing;
end;
$$;
