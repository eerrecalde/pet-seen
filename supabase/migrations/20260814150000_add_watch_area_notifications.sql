-- PS-405: people can watch a small area without publishing their location.
create type public.watch_notification_status as enum ('pending', 'push_sent', 'email_sent', 'failed');

create table public.watch_areas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 100),
  centre extensions.geometry(Point, 4326) not null,
  radius_metres integer not null default 2000 check (radius_metres between 250 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index watch_areas_centre_gix on public.watch_areas using gist (centre);
create index watch_areas_owner_idx on public.watch_areas (owner_id, created_at desc);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%'),
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_owner_idx on public.push_subscriptions (owner_id);

create table public.watch_notifications (
  id uuid primary key default gen_random_uuid(),
  watch_area_id uuid not null references public.watch_areas (id) on delete cascade,
  sighting_id uuid not null references public.sightings (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  status public.watch_notification_status not null default 'pending',
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (watch_area_id, sighting_id)
);

create index watch_notifications_status_idx on public.watch_notifications (status, created_at);

create trigger watch_areas_set_updated_at before update on public.watch_areas for each row execute procedure public.set_record_updated_at();
create trigger push_subscriptions_set_updated_at before update on public.push_subscriptions for each row execute procedure public.set_record_updated_at();

alter table public.watch_areas enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.watch_notifications enable row level security;
revoke all on table public.watch_areas, public.push_subscriptions, public.watch_notifications from public;

create policy "Owners manage their watch areas" on public.watch_areas for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Owners manage their own push subscriptions" on public.push_subscriptions for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create function public.queue_watch_area_notifications()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into public.watch_notifications (watch_area_id, sighting_id, recipient_id)
  select area.id, new.id, area.owner_id
  from public.watch_areas area
  where extensions.st_dwithin(area.centre::extensions.geography, new.exact_location::extensions.geography, area.radius_metres);
  return new;
end;
$$;

create trigger sightings_queue_watch_area_notifications
  after insert on public.sightings for each row execute procedure public.queue_watch_area_notifications();

revoke all on function public.queue_watch_area_notifications() from public;
