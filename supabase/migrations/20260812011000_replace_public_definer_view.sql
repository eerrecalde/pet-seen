-- PS-102 security hardening: replace the original public SECURITY DEFINER view
-- with a physically separate public-safe projection table.

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'public_missing_cases'
      and c.relkind = 'v'
  ) then
    drop view public.public_missing_cases;
  end if;
end;
$$;

create table if not exists public.public_missing_cases (
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

drop policy if exists "Anyone can read public missing cases" on public.public_missing_cases;
create policy "Anyone can read public missing cases"
  on public.public_missing_cases for select to anon, authenticated
  using (true);

create or replace function public.sync_public_missing_case(target_case_id uuid)
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

create or replace function public.sync_public_missing_case_from_case()
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

create or replace function public.sync_public_missing_cases_from_pet()
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

drop trigger if exists missing_cases_sync_public_projection on public.missing_cases;
create trigger missing_cases_sync_public_projection
  after insert or update or delete on public.missing_cases
  for each row execute procedure public.sync_public_missing_case_from_case();

drop trigger if exists pets_sync_public_projection on public.pets;
create trigger pets_sync_public_projection
  after update of name, species, breed, colour, description on public.pets
  for each row execute procedure public.sync_public_missing_cases_from_pet();

revoke all on function public.sync_public_missing_case(uuid) from public;
revoke all on function public.sync_public_missing_case_from_case() from public;
revoke all on function public.sync_public_missing_cases_from_pet() from public;

-- Populate the projection for any local cases that existed before this migration.
do $$
declare
  published_case record;
begin
  for published_case in select id from public.missing_cases where status = 'published'
  loop
    perform public.sync_public_missing_case(published_case.id);
  end loop;
end;
$$;
