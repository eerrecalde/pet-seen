-- PS-408: a fail-closed automatic screening error must be visible to staff.
alter table public.found_pet_report_moderation_audit
  drop constraint found_pet_report_moderation_audit_event_check,
  add constraint found_pet_report_moderation_audit_event_check check (event in (
    'submitted_for_review', 'approved', 'rejected', 'rejected_files_deleted',
    'automatically_approved', 'automatically_rejected', 'automatic_screening_failed',
    'photo_processing_started', 'photo_processing_completed', 'photo_processing_failed',
    'resolved', 'expired', 'reopened', 'deleted', 'deleted_files_deleted',
    'retention_deleted', 'retention_files_deleted'
  ));
