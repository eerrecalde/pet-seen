-- PS-405 follow-up: RLS policies do not grant database privileges themselves.
grant select, insert, update, delete on table public.watch_areas to authenticated;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;
