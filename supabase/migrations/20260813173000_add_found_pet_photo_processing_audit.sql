-- PS-411: retain minimal, staff-only operational evidence for intermittent
-- photo-processing failures. No submitted text, image bytes or EXIF is logged.

alter table public.found_pet_report_moderation_audit
  add column metadata jsonb not null default '{}'::jsonb,
  drop constraint found_pet_report_moderation_audit_event_check,
  add constraint found_pet_report_moderation_audit_event_check check (event in (
    'submitted_for_review', 'approved', 'rejected', 'rejected_files_deleted',
    'automatically_approved', 'automatically_rejected',
    'photo_processing_started', 'photo_processing_completed', 'photo_processing_failed'
  ));
