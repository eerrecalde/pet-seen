// Public case photos are processed derivatives only. The source upload remains
// private, and a published case is the sole condition for issuing a short-lived
// URL to its display image.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const slugPattern = /^[a-z0-9]{10,32}$/

Deno.serve(async (request) => {
  const slug = new URL(request.url).searchParams.get('slug')
  if (!slug || !slugPattern.test(slug))
    return new Response('Not found', { status: 404 })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey)
    return new Response('Photo delivery is unavailable.', { status: 500 })
  const admin = createClient(supabaseUrl, serviceRoleKey)

  const { data: publicCase } = await admin
    .from('public_missing_cases')
    .select('case_id')
    .eq('public_slug', slug)
    .maybeSingle<{ case_id: string }>()
  if (!publicCase) return new Response('Not found', { status: 404 })

  const { data: missingCase } = await admin
    .from('missing_cases')
    .select('pet_id')
    .eq('id', publicCase.case_id)
    .eq('status', 'published')
    .maybeSingle<{ pet_id: string }>()
  if (!missingCase) return new Response('Not found', { status: 404 })

  const { data: photo } = await admin
    .from('pet_photos')
    .select('display_object_path')
    .eq('pet_id', missingCase.pet_id)
    .eq('status', 'processed')
    .not('display_object_path', 'is', null)
    .order('processed_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ display_object_path: string }>()
  if (!photo?.display_object_path)
    return new Response('Not found', { status: 404 })

  const { data: signed, error } = await admin.storage
    .from('pet-photos')
    .createSignedUrl(photo.display_object_path, 60 * 60)
  if (error || !signed?.signedUrl)
    return new Response('Photo delivery is unavailable.', { status: 500 })
  return Response.redirect(signed.signedUrl, 302)
})
