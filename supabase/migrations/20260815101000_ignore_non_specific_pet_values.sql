-- PS-413: Unknown, Mixed and Other are display choices, not breed evidence.
create or replace function public.pet_match_canonical(input text)
returns text language sql immutable strict parallel safe as $$
  with canonical as (select nullif(regexp_replace(lower(trim(input)), '[^[:alnum:]]', '', 'g'), '') as value)
  select case when value in ('unknown', 'mixed', 'other') then null else value end from canonical;
$$;
