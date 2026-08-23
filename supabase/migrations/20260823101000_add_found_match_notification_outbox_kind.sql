-- PS-408: a possible found-pet match deserves a reliable owner notification.
alter type public.workflow_outbox_kind
  add value if not exists 'owner_found_pet_match_email';
