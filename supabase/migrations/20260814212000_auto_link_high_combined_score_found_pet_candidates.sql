-- PS-408: a strong AI assessment may promote the top deterministic candidate,
-- but it cannot suppress a strong deterministic match.

create or replace function public.create_provisional_found_pet_match(target_report_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare best record; latest_combined_score smallint;
begin
  select * into best from public.found_pet_case_candidates(target_report_id) limit 1;
  if best.case_id is null then return false; end if;

  select s.combined_score into latest_combined_score
  from public.ai_found_pet_match_scores s
  join public.ai_found_pet_match_runs r on r.id = s.run_id
  where s.found_pet_report_id = target_report_id and s.case_id = best.case_id
  order by r.created_at desc
  limit 1;

  if best.match_score < 90 and coalesce(latest_combined_score, 0) < 90 then return false; end if;

  insert into public.found_pet_case_links (found_pet_report_id, case_id, match_score, match_reasons)
  values (target_report_id, best.case_id, best.match_score, best.match_reasons)
  on conflict (found_pet_report_id, case_id) do nothing;
  return found;
end;
$$;
