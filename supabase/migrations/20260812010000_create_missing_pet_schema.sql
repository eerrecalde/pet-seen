-- PS-102: Core records, location separation, private photo storage and access rules.
-- Exact locations never have a public table policy. Public clients use the
-- public_missing_cases view below, which selects only the persisted coarse point.

create extension if not exists postgis with schema extensions;

create type public.pet_species as enum ('dog', 'cat');
create type public.missing_case_status as enum (
  'draft', 'published', 'closed', 'reunited', 'removed', 'expired'
);
create type public.pet_photo_status as enum ('pending', 'processed', 'failed');
create type public.app_role as enum ('administrator', 'moderator');

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users (id) on delete set null,
  primary key (user_id, role)
);

create table public.pets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  species public.pet_species not null,
  breed text check (char_length(trim(breed)) <= 120),
  colour text check (char_length(trim(colour)) <= 120),
  description text check (char_length(trim(description)) <= 1500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.missing_cases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  pet_id uuid not null references public.pets (id) on delete restrict,
  public_slug text not null unique
    check (public_slug ~ '^[a-z0-9]{10,32}$'),
  status public.missing_case_status not null default 'draft',
  title text check (char_length(trim(title)) between 1 and 140),
  last_seen_at timestamptz,
  last_seen_description text check (char_length(trim(last_seen_description)) <= 1500),
  -- This is the source of truth and is selectable only by owner/staff policies.
  exact_location extensions.geometry(Point, 4326),
  -- Never accepted as client truth: the trigger derives it from exact_location.
  public_location extensions.geometry(Point, 4326),
  published_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint missing_cases_location_pair_check check (
    (exact_location is null and public_location is null)
    or (exact_location is not null and public_location is not null)
  ),
  constraint missing_cases_publication_check check (
    status <> 'published' or (published_at is not null and exact_location is not null)
  )
);

create table public.pet_photos (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  source_object_path text not null unique,
  display_object_path text unique,
  status public.pet_photo_status not null default 'pending',
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint pet_photos_source_path_check check (
    source_object_path ~ '^[0-9a-f-]{36}/source/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
  ),
  constraint pet_photos_display_path_check check (
    display_object_path is null
    or display_object_path ~ '^[0-9a-f-]{36}/display/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
  ),
  constraint pet_photos_processing_check check (
    (status = 'processed' and display_object_path is not null and processed_at is not null)
    or (status <> 'processed' and display_object_path is null)
  )
);

create index pets_owner_id_idx on public.pets (owner_id);
create index missing_cases_owner_id_idx on public.missing_cases (owner_id);
create index missing_cases_pet_id_idx on public.missing_cases (pet_id);
create index missing_cases_status_published_at_idx on public.missing_cases (status, published_at desc);
create index missing_cases_exact_location_gix on public.missing_cases using gist (exact_location);
create index missing_cases_public_location_gix on public.missing_cases using gist (public_location);
create index pet_photos_pet_id_idx on public.pet_photos (pet_id);

create function public.is_authorized_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role in ('administrator', 'moderator')
  );
$$;

create function public.set_record_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- A fixed 0.02° grid (roughly 1–2 km in the UK) prevents repeated public
-- reads from narrowing an exact point while remaining useful at area level.
create function public.set_case_public_location()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if new.exact_location is null then
    new.public_location = null;
  else
    new.public_location = extensions.st_setsrid(
      extensions.st_snaptogrid(new.exact_location, 0.02),
      4326
    )::extensions.geometry(Point, 4326);
  end if;
  return new;
end;
$$;

create function public.validate_case_pet_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.pets where id = new.pet_id and owner_id = new.owner_id
  ) then
    raise exception 'A missing case must belong to the pet owner';
  end if;
  return new;
end;
$$;

create function public.validate_photo_pet_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.pets where id = new.pet_id and owner_id = new.owner_id
  ) then
    raise exception 'A photo must belong to the pet owner';
  end if;
  return new;
end;
$$;

create trigger pets_set_updated_at
  before update on public.pets
  for each row execute procedure public.set_record_updated_at();

create trigger missing_cases_validate_pet_owner
  before insert or update of pet_id, owner_id on public.missing_cases
  for each row execute procedure public.validate_case_pet_owner();

create trigger missing_cases_set_public_location
  before insert or update of exact_location, public_location on public.missing_cases
  for each row execute procedure public.set_case_public_location();

create trigger missing_cases_set_updated_at
  before update on public.missing_cases
  for each row execute procedure public.set_record_updated_at();

create trigger pet_photos_validate_pet_owner
  before insert or update of pet_id, owner_id on public.pet_photos
  for each row execute procedure public.validate_photo_pet_owner();

alter table public.user_roles enable row level security;
alter table public.pets enable row level security;
alter table public.missing_cases enable row level security;
alter table public.pet_photos enable row level security;

revoke all on table public.user_roles, public.pets, public.missing_cases, public.pet_photos from anon;
grant select, insert, update, delete on table public.pets, public.missing_cases, public.pet_photos to authenticated;

create policy "Staff can read role assignments"
  on public.user_roles for select to authenticated
  using ((select public.is_authorized_staff()));

create policy "Owners and staff can read pets"
  on public.pets for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_authorized_staff()));

create policy "Owners can create pets"
  on public.pets for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Owners and staff can update pets"
  on public.pets for update to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_authorized_staff()))
  with check (owner_id = (select auth.uid()) or (select public.is_authorized_staff()));

create policy "Owners and staff can delete pets"
  on public.pets for delete to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_authorized_staff()));

create policy "Owners and staff can read missing cases"
  on public.missing_cases for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_authorized_staff()));

create policy "Owners can create missing cases"
  on public.missing_cases for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Owners and staff can update missing cases"
  on public.missing_cases for update to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_authorized_staff()))
  with check (owner_id = (select auth.uid()) or (select public.is_authorized_staff()));

create policy "Owners and staff can delete missing cases"
  on public.missing_cases for delete to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_authorized_staff()));

create policy "Owners and staff can read pet photos"
  on public.pet_photos for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_authorized_staff()));

create policy "Owners can create pet photos"
  on public.pet_photos for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Owners and staff can update pet photos"
  on public.pet_photos for update to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_authorized_staff()))
  with check (owner_id = (select auth.uid()) or (select public.is_authorized_staff()));

create policy "Owners and staff can delete pet photos"
  on public.pet_photos for delete to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_authorized_staff()));

-- This projection deliberately has no exact geometry or owner identifier. It
-- is the only relation that anonymous clients may query for published cases.
create table public.public_missing_cases (
  case_id uuid primary key references public.missing_cases (id) on delete cascade,
  public_slug text not null unique,
  title text,
  last_seen_at timestamptz,
  last_seen_description text,
  published_at timestamptz not null,
  pet_name text not null,
  species public.pet_species not null,
  breed text,
  colour text,
  pet_description text,
  public_latitude double precision not null,
  public_longitude double precision not null,
  constraint public_missing_cases_latitude_check check (public_latitude between -90 and 90),
  constraint public_missing_cases_longitude_check check (public_longitude between -180 and 180)
);

alter table public.public_missing_cases enable row level security;
revoke all on table public.public_missing_cases from public;
grant select on table public.public_missing_cases to anon, authenticated;

create policy "Anyone can read public missing cases"
  on public.public_missing_cases for select to anon, authenticated
  using (true);

-- This function is callable only by database triggers. It runs with table-owner
-- privileges so a case owner cannot write to the public projection directly.
create function public.sync_public_missing_case(target_case_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  delete from public.public_missing_cases where case_id = target_case_id;

  insert into public.public_missing_cases (
    case_id, public_slug, title, last_seen_at, last_seen_description, published_at,
    pet_name, species, breed, colour, pet_description, public_latitude, public_longitude
  )
  select
    c.id, c.public_slug, c.title, c.last_seen_at, c.last_seen_description, c.published_at,
    p.name, p.species, p.breed, p.colour, p.description,
    extensions.st_y(c.public_location), extensions.st_x(c.public_location)
  from public.missing_cases c
  join public.pets p on p.id = c.pet_id
  where c.id = target_case_id
    and c.status = 'published';
end;
$$;

create function public.sync_public_missing_case_from_case()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.public_missing_cases where case_id = old.id;
    return old;
  end if;

  perform public.sync_public_missing_case(new.id);
  return new;
end;
$$;

create function public.sync_public_missing_cases_from_pet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  matching_case record;
begin
  for matching_case in
    select id from public.missing_cases where pet_id = new.id
  loop
    perform public.sync_public_missing_case(matching_case.id);
  end loop;
  return new;
end;
$$;

create trigger missing_cases_sync_public_projection
  after insert or update or delete on public.missing_cases
  for each row execute procedure public.sync_public_missing_case_from_case();

create trigger pets_sync_public_projection
  after update of name, species, breed, colour, description on public.pets
  for each row execute procedure public.sync_public_missing_cases_from_pet();

revoke all on function public.sync_public_missing_case(uuid) from public;
revoke all on function public.sync_public_missing_case_from_case() from public;
revoke all on function public.sync_public_missing_cases_from_pet() from public;

revoke all on function public.is_authorized_staff() from public;
grant execute on function public.is_authorized_staff() to authenticated;

-- Source uploads and the processed public-display derivatives share one private
-- bucket. Only a server process may write derivatives or make signed public URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pet-photos',
  'pet-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Owners can upload source pet photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'pet-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and (storage.foldername(name))[2] = 'source'
  );

create policy "Owners and staff can read pet photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'pet-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid()::text)
      or (select public.is_authorized_staff())
    )
  );

create policy "Owners can update source pet photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'pet-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and (storage.foldername(name))[2] = 'source'
  )
  with check (
    bucket_id = 'pet-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and (storage.foldername(name))[2] = 'source'
  );

create policy "Owners and staff can delete pet photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'pet-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid()::text)
      or (select public.is_authorized_staff())
    )
  );
