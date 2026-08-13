-- PS-411 fix: PostgreSQL regular expressions use one backslash to escape the
-- dot. The earlier double escape rejected every normal source/<uuid>.jpg path.

create or replace function public.can_upload_found_pet_photo(target_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_name ~ '^source/[0-9a-f-]{36}\.jpg$'
    and exists (
      select 1 from public.found_pet_reports
      where id = substring(target_name from '^source/([0-9a-f-]{36})\.jpg$')::uuid
    );
$$;

alter table public.found_pet_photos
  drop constraint found_pet_photos_source_object_path_check,
  drop constraint found_pet_photos_display_object_path_check,
  add constraint found_pet_photos_source_object_path_check
    check (source_object_path ~ '^source/[0-9a-f-]{36}\.jpg$'),
  add constraint found_pet_photos_display_object_path_check
    check (display_object_path is null or display_object_path ~ '^display/[0-9a-f-]{36}\.jpg$');
