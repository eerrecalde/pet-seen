-- PS-408: only the overall strongest AI-assisted candidate may create one
-- provisional owner-review link. A rerun must never notify another owner while
-- an owner has an active match to review.

create or replace function public.create_provisional_found_pet_match(target_report_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare best record;
begin
  if exists (
    select 1 from public.found_pet_case_links
    where found_pet_report_id = target_report_id
      and status in ('pending_owner', 'confirmed')
  ) then
    return false;
  end if;

  select candidate.*, score.combined_score, score.confidence into best
  from public.found_pet_case_candidates(target_report_id) candidate
  join lateral (
    select s.combined_score, s.confidence
    from public.ai_found_pet_match_scores s
    join public.ai_found_pet_match_runs r on r.id = s.run_id
    where s.found_pet_report_id = target_report_id and s.case_id = candidate.case_id
    order by r.created_at desc
    limit 1
  ) score on true
  order by score.combined_score desc, candidate.match_score desc, candidate.case_id
  limit 1;

  if best.case_id is null
    or best.match_score < 80
    or best.combined_score < 80
    or best.confidence not in ('medium'::public.ai_match_confidence, 'high'::public.ai_match_confidence)
  then
    return false;
  end if;

  insert into public.found_pet_case_links (
    found_pet_report_id, case_id, match_score, match_reasons
  ) values (
    target_report_id, best.case_id, best.match_score, best.match_reasons
  ) on conflict (found_pet_report_id, case_id) do nothing;
  return found;
end;
$$;
