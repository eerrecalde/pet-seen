-- PS-410: a found-pet photo is optional and private. It is never a reporter
-- portrait and is available only for matching and owner review.

create table public.found_pet_photos (
  id uuid primary key default gen_random_uuid(),
  found_pet_report_id uuid not null unique references public.found_pet_reports (id) on delete cascade,
  source_object_path text not null unique check (source_object_path ~ '^source/[0-9a-f-]{36}\\.jpg$'),
  display_object_path text unique check (display_object_path is null or display_object_path ~ '^display/[0-9a-f-]{36}\\.jpg$'),
  status public.pet_photo_status not null default 'pending',
  processing_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint found_pet_photo_processing_check check (
    (status = 'processed' and display_object_path is not null and processed_at is not null)
    or (status <> 'processed' and display_object_path is null)
  )
);

alter table public.found_pet_photos enable row level security;
revoke all on public.found_pet_photos from anon, authenticated;

create policy "Staff can read found pet photos"
  on public.found_pet_photos for select to authenticated
  using ((select public.is_authorized_staff()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('found-pet-photos', 'found-pet-photos', false, 5242880, array['image/jpeg']::text[]);

create function public.can_upload_found_pet_photo(target_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_name ~ '^source/[0-9a-f-]{36}\\.jpg$'
    and exists (
      select 1 from public.found_pet_reports
      where id = substring(target_name from '^source/([0-9a-f-]{36})\\.jpg$')::uuid
    );
$$;

create policy "Anyone can upload a prepared found pet photo"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'found-pet-photos' and public.can_upload_found_pet_photo(name));

create function public.attach_found_pet_photo(target_report_id uuid, submission_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare photo_id uuid;
begin
  if not exists (
    select 1 from public.found_pet_reports
    where id = target_report_id and client_submission_id = submission_token
  ) then
    raise exception 'Found-pet report not found';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'found-pet-photos' and name = 'source/' || target_report_id::text || '.jpg'
  ) then
    raise exception 'Found-pet photo upload not found';
  end if;
  insert into public.found_pet_photos (found_pet_report_id, source_object_path)
  values (target_report_id, 'source/' || target_report_id::text || '.jpg')
  on conflict (found_pet_report_id) do update set status = 'pending', processing_error = null
  returning id into photo_id;
  return photo_id;
end;
$$;

revoke all on function public.can_upload_found_pet_photo(text) from public;
revoke all on function public.attach_found_pet_photo(uuid, uuid) from public;
grant execute on function public.can_upload_found_pet_photo(text) to anon, authenticated;
grant execute on function public.attach_found_pet_photo(uuid, uuid) to anon, authenticated;
