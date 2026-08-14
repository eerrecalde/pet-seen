-- PS-411: Edge Functions use the database service role. Bypassing RLS does
-- not itself confer table privileges, so grant only the operations used by the
-- photo processor and automated safety-screening workflow.

grant select, update on table public.found_pet_photos to service_role;
grant select, update, delete on table public.found_pet_reports to service_role;
grant insert on table public.found_pet_report_moderation_audit to service_role;
