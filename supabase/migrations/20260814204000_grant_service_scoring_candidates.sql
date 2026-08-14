-- PS-408: automatic scoring runs under Supabase's service role, which needs
-- execute access to the staff/private deterministic shortlist RPC.
grant execute on function public.found_pet_case_candidates(uuid) to service_role;
