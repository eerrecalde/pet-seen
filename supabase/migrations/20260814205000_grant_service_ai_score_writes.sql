-- PS-408: scoring functions use the service role to retain internal analysis
-- runs and results; browser roles remain read-only staff-only via RLS.
grant select, insert, update on public.ai_found_pet_match_runs, public.ai_found_pet_match_scores to service_role;
grant select, insert, update on public.ai_unlinked_sighting_match_runs, public.ai_unlinked_sighting_match_scores to service_role;
