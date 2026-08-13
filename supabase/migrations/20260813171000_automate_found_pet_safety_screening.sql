-- PS-411 follow-up: automated provider decisions can approve/reject without a
-- staff user; an unavailable or malformed provider result remains pending.

alter table public.found_pet_reports
  drop constraint found_pet_reports_moderation_check,
  add constraint found_pet_reports_moderation_check check (
    (moderation_status = 'pending' and moderated_at is null and moderated_by is null)
    or (moderation_status in ('approved', 'rejected') and moderated_at is not null)
  );

alter table public.found_pet_report_moderation_audit
  drop constraint found_pet_report_moderation_audit_event_check,
  add constraint found_pet_report_moderation_audit_event_check check (event in (
    'submitted_for_review', 'approved', 'rejected', 'rejected_files_deleted',
    'automatically_approved', 'automatically_rejected'
  ));
