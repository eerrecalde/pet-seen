-- PS-408: automatically surface strong, photo-supported matches to an owner
-- while keeping low-confidence candidates for staff review only.

create or replace function public.create_provisional_found_pet_match(target_report_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare best record;
begin
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
  where candidate.match_score >= 80
    and score.combined_score >= 80
    and score.confidence in ('medium'::public.ai_match_confidence, 'high'::public.ai_match_confidence)
  order by score.combined_score desc, candidate.match_score desc
  limit 1;

  if best.case_id is null then return false; end if;

  insert into public.found_pet_case_links (found_pet_report_id, case_id, match_score, match_reasons)
  values (target_report_id, best.case_id, best.match_score, best.match_reasons)
  on conflict (found_pet_report_id, case_id) do nothing;
  return found;
end;
$$;
