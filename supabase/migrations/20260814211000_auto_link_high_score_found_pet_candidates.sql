-- PS-408: favour an owner-review opportunity over suppressing a close
-- deterministic found-pet match because an AI assessment is uncertain.

create or replace function public.create_provisional_found_pet_match(target_report_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare best record;
begin
  select * into best from public.found_pet_case_candidates(target_report_id) limit 1;
  if best.case_id is null or best.match_score < 90 then return false; end if;

  insert into public.found_pet_case_links (found_pet_report_id, case_id, match_score, match_reasons)
  values (target_report_id, best.case_id, best.match_score, best.match_reasons)
  on conflict (found_pet_report_id, case_id) do nothing;
  return found;
end;
$$;
