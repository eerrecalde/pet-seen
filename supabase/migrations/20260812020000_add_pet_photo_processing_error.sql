-- PS-104: Make image-processing outcomes explicit for owners and staff.

alter table public.pet_photos
  add column processing_error text
  check (processing_error is null or char_length(processing_error) <= 300);

alter table public.pet_photos
  drop constraint pet_photos_processing_check,
  add constraint pet_photos_processing_check check (
    (status = 'pending' and display_object_path is null and processing_error is null)
    or (status = 'processed' and display_object_path is not null and processed_at is not null and processing_error is null)
    or (status = 'failed' and display_object_path is null and processing_error is not null)
  );
