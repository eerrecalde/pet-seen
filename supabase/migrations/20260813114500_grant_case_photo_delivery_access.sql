-- The public case-photo function resolves a public slug, verifies that the
-- underlying case remains published, and then signs its processed derivative.
grant select on table public.public_missing_cases, public.missing_cases to service_role;
