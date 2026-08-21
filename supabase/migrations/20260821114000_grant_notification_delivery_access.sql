-- PS-419: service-role Edge Functions bypass RLS but still need ordinary table
-- privileges. Restrict these grants to the private rows they deliver.
grant select, update on public.owner_email_notifications to service_role;
grant select on public.sightings, public.missing_cases, public.pets to service_role;

grant select, update on public.watch_notifications to service_role;
grant select on public.watch_areas, public.push_subscriptions to service_role;
grant delete on public.push_subscriptions to service_role;
