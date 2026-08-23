-- PS-408: AI scoring informs staff review but never supersedes staff judgement.
-- A moderator may link any case in the conservative deterministic shortlist.
-- Keep the PS-419 durable owner-email handoff introduced after this rule.

create or replace function public.link_unlinked_sighting_to_case(target_sighting_id uuid, target_case_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_authorized_staff() then
    raise exception 'Only Pet Seen staff can link unlinked sightings';
  end if;

  if not exists (
    select 1
    from public.unlinked_sighting_case_candidates(target_sighting_id)
    where case_id = target_case_id
  ) then
    raise exception 'That active case is not a matching candidate';
  end if;

  update public.sightings
  set case_id = target_case_id
  where id = target_sighting_id and case_id is null;
  if not found then
    raise exception 'This sighting is already linked or unavailable';
  end if;

  insert into public.owner_email_notifications (sighting_id, recipient_id)
  select target_sighting_id, c.owner_id
  from public.missing_cases c
  where c.id = target_case_id
  on conflict (sighting_id) do nothing;

  insert into public.workflow_outbox (kind, aggregate_id)
  values ('owner_sighting_email', target_sighting_id)
  on conflict (kind, aggregate_id) do nothing;
end;
$$;
