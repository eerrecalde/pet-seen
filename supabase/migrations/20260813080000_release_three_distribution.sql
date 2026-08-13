-- Release 3: public-safe discovery and anonymous sharing attribution.
-- All public geometries remain derived server-side on the same coarse grid used
-- for public missing-case areas; exact sighting locations are never exposed.

alter table public.sightings
  add column public_location extensions.geometry(Point, 4326);

create index sightings_public_location_gix on public.sightings using gist (public_location);

create function public.set_sighting_public_location()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.public_location = extensions.st_setsrid(
    extensions.st_snaptogrid(new.exact_location, 0.02),
    4326
  )::extensions.geometry(Point, 4326);
  return new;
end;
$$;

create trigger sightings_set_public_location
  before insert or update of exact_location on public.sightings
  for each row execute procedure public.set_sighting_public_location();

-- Backfill is safe because this result is still not public until confirmed.
update public.sightings
set public_location = extensions.st_setsrid(
  extensions.st_snaptogrid(exact_location, 0.02),
  4326
);

create table public.public_nearby_sightings (
  sighting_id uuid primary key references public.sightings (id) on delete cascade,
  case_id uuid not null references public.missing_cases (id) on delete cascade,
  public_latitude double precision not null check (public_latitude between -90 and 90),
  public_longitude double precision not null check (public_longitude between -180 and 180),
  seen_at timestamptz not null
);

alter table public.public_nearby_sightings enable row level security;
revoke all on table public.public_nearby_sightings from public;
grant select on table public.public_nearby_sightings to anon, authenticated;
create policy "Anyone can read public nearby sightings"
  on public.public_nearby_sightings for select to anon, authenticated using (true);

create function public.sync_public_nearby_sighting(target_sighting_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  delete from public.public_nearby_sightings where sighting_id = target_sighting_id;
  insert into public.public_nearby_sightings (sighting_id, case_id, public_latitude, public_longitude, seen_at)
  select s.id, s.case_id, extensions.st_y(s.public_location), extensions.st_x(s.public_location), s.seen_at
  from public.sightings s
  join public.missing_cases c on c.id = s.case_id
  where s.id = target_sighting_id
    and s.case_id is not null
    and s.report_status = 'confirmed'
    and c.status = 'published'
    and s.public_location is not null;
end;
$$;

create function public.sync_public_nearby_sighting_from_sighting()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.public_nearby_sightings where sighting_id = old.id;
    return old;
  end if;
  perform public.sync_public_nearby_sighting(new.id);
  return new;
end;
$$;

create function public.sync_public_nearby_sightings_from_case()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare sighting_record record;
begin
  for sighting_record in select id from public.sightings where case_id = new.id loop
    perform public.sync_public_nearby_sighting(sighting_record.id);
  end loop;
  return new;
end;
$$;

create trigger sightings_sync_public_nearby_projection
  after insert or update of case_id, report_status, public_location or delete on public.sightings
  for each row execute procedure public.sync_public_nearby_sighting_from_sighting();
create trigger missing_cases_sync_public_nearby_sightings
  after update of status on public.missing_cases
  for each row execute procedure public.sync_public_nearby_sightings_from_case();

-- Tokens distinguish a sharing method without storing visitor identity.
create table public.share_attributions (
  token uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.missing_cases (id) on delete cascade,
  channel text not null check (channel in ('copy', 'web_share', 'whatsapp', 'poster')),
  created_at timestamptz not null default now(),
  first_visited_at timestamptz
);
create index share_attributions_case_id_idx on public.share_attributions (case_id, created_at desc);
alter table public.share_attributions enable row level security;
revoke all on table public.share_attributions from public;

create function public.create_share_attribution(case_slug text, share_channel text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare share_token uuid;
begin
  insert into public.share_attributions (case_id, channel)
  select case_id, share_channel
  from public.public_missing_cases
  where public_slug = case_slug
  returning token into share_token;
  if share_token is null then raise exception 'That missing-pet case is no longer available'; end if;
  return share_token;
end;
$$;

create function public.record_share_attribution(case_slug text, share_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.share_attributions a
  set first_visited_at = coalesce(a.first_visited_at, now())
  from public.public_missing_cases c
  where a.token = share_token and a.case_id = c.case_id and c.public_slug = case_slug;
end;
$$;

revoke all on function public.set_sighting_public_location() from public;
revoke all on function public.sync_public_nearby_sighting(uuid) from public;
revoke all on function public.sync_public_nearby_sighting_from_sighting() from public;
revoke all on function public.sync_public_nearby_sightings_from_case() from public;
revoke all on function public.create_share_attribution(text, text) from public;
revoke all on function public.record_share_attribution(text, uuid) from public;
grant execute on function public.create_share_attribution(text, text) to anon, authenticated;
grant execute on function public.record_share_attribution(text, uuid) to anon, authenticated;
