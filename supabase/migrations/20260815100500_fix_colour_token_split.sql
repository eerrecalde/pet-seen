-- Correct the whitespace expression used by the PS-413 tokeniser.
create or replace function public.pet_colour_tokens(input text)
returns text[] language sql immutable strict parallel safe as $$
  with tokens as (
    select case when token = 'grey' then 'gray' else token end as token
    from regexp_split_to_table(regexp_replace(lower(trim(input)), '[^[:alnum:]]+', ' ', 'g'), '\s+') as token
  )
  select coalesce(array_agg(token order by token), '{}')
  from (
    select distinct token from tokens
    where token <> '' and token not in ('a', 'an', 'and', 'or', 'the', 'with', 'unknown', 'mixed', 'other')
  ) meaningful_tokens;
$$;
