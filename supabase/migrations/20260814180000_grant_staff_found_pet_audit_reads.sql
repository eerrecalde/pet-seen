-- The staff-only RLS policy already protects this table. Granting SELECT makes
-- that policy effective for staff audit review and staging lifecycle checks.
grant select on public.found_pet_report_moderation_audit to authenticated;
