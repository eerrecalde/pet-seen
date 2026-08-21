-- PS-419: the scheduled Edge Function runs as service_role. SECURITY DEFINER
-- does not bypass EXECUTE privileges, so grant the worker only these private
-- queue-transition functions.
grant execute on function public.claim_workflow_outbox(integer), public.complete_workflow_outbox(uuid, boolean, text) to service_role;
