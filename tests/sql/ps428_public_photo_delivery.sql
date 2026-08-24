-- PS-428 database regression contract. Run with:
-- docker exec -i supabase_db_pet-seen psql -v ON_ERROR_STOP=1 -U postgres -d postgres < tests/sql/ps428_public_photo_delivery.sql

begin;

do $$
declare
  public_columns text[];
begin
  select array_agg(column_name order by column_name)
    into public_columns
  from information_schema.columns
  where table_schema = 'public' and table_name = 'public_missing_cases';

  if not ('photo_version' = any(public_columns)) then
    raise exception 'PS-428 public projection is missing its safe photo version';
  end if;
  if 'display_object_path' = any(public_columns)
     or 'card_object_path' = any(public_columns)
     or 'source_object_path' = any(public_columns) then
    raise exception 'PS-428 leaked a private Storage path into the public projection';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.pet_photos'::regclass
      and tgname = 'pet_photos_sync_public_projection'
      and not tgisinternal
  ) then
    raise exception 'PS-428 photo changes do not refresh the public image version';
  end if;
end;
$$;

rollback;
