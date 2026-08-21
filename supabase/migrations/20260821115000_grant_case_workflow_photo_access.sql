-- PS-419: submit-workflow writes the owner-scoped photo row after the
-- transactional case draft is created, then process-pet-photo updates it.
grant select, insert on public.pet_photos to service_role;
