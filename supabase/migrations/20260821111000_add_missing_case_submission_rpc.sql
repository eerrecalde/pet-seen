-- The first missing-case screen creates the pet and the draft case together.
-- A network failure can therefore never leave an owner with an orphan pet.
create or replace function public.create_missing_case_draft(
  pet_name text, pet_species public.pet_species, pet_breed text, pet_colour text, pet_description text
) returns table (case_id uuid, pet_id uuid)
language plpgsql security definer set search_path = public as $$
declare created_pet_id uuid; created_case_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  if nullif(trim(pet_name), '') is null then raise exception 'Enter your pet''s name'; end if;
  insert into public.pets (owner_id, name, species, breed, colour, description)
  values (auth.uid(), trim(pet_name), pet_species, nullif(trim(pet_breed), ''), nullif(trim(pet_colour), ''), nullif(trim(pet_description), ''))
  returning id into created_pet_id;
  insert into public.missing_cases (owner_id, pet_id, status, title)
  values (auth.uid(), created_pet_id, 'draft', trim(pet_name) || ' is missing')
  returning id into created_case_id;
  return query select created_case_id, created_pet_id;
end;
$$;

create or replace function public.discard_missing_case_draft(target_case_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare target_pet_id uuid;
begin
  select pet_id into target_pet_id from public.missing_cases
  where id = target_case_id and owner_id = auth.uid() and status = 'draft';
  if target_pet_id is null then raise exception 'Draft case not found'; end if;
  delete from public.missing_cases where id = target_case_id;
  delete from public.pets where id = target_pet_id and owner_id = auth.uid();
end;
$$;

revoke all on function public.create_missing_case_draft(text, public.pet_species, text, text, text), public.discard_missing_case_draft(uuid) from public;
grant execute on function public.create_missing_case_draft(text, public.pet_species, text, text, text), public.discard_missing_case_draft(uuid) to authenticated;
