// Public case photos are processed derivatives only. The source upload remains
// private, and a published case is the sole condition for streaming a derivative.
// The versioned URL lets browser/CDN caches reuse image bytes without exposing a
// Storage URL or minting a signed URL per visitor.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const slugPattern = /^[a-z0-9]{10,32}$/
const versionPattern = /^[0-9a-f-]{36}-\d+$/
const cacheControl = 'public, max-age=300, s-maxage=300, stale-while-revalidate=60'

Deno.serve(async (request) => {
  const slug = new URL(request.url).searchParams.get('slug')
  const version = new URL(request.url).searchParams.get('v')
  const variant = new URL(request.url).searchParams.get('variant') ?? 'display'
  if (
    !slug ||
    !slugPattern.test(slug) ||
    !version ||
    !versionPattern.test(version) ||
    !['card', 'display'].includes(variant)
  )
    return new Response('Not found', { status: 404 })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey)
    return new Response('Photo delivery is unavailable.', { status: 500 })
  const admin = createClient(supabaseUrl, serviceRoleKey)

  const { data: publicCase } = await admin
    .from('public_missing_cases')
    .select('case_id,photo_version')
    .eq('public_slug', slug)
    .maybeSingle<{ case_id: string; photo_version: string | null }>()
  if (!publicCase || publicCase.photo_version !== version)
    return new Response('Not found', { status: 404 })

  const { data: missingCase } = await admin
    .from('missing_cases')
    .select('pet_id')
    .eq('id', publicCase.case_id)
    .eq('status', 'published')
    .maybeSingle<{ pet_id: string }>()
  if (!missingCase) return new Response('Not found', { status: 404 })

  const { data: photo } = await admin
    .from('pet_photos')
    .select('id,display_object_path,card_object_path,processed_at')
    .eq('pet_id', missingCase.pet_id)
    .eq('status', 'processed')
    .not('display_object_path', 'is', null)
    .order('processed_at', { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string
      display_object_path: string | null
      card_object_path: string | null
      processed_at: string
    }>()
  const expectedVersion = photo
    ? `${photo.id}-${Math.floor(new Date(photo.processed_at).getTime() / 1000)}`
    : null
  const objectPath =
    variant === 'card'
      ? (photo?.card_object_path ?? photo?.display_object_path)
      : photo?.display_object_path
  if (!objectPath || expectedVersion !== version)
    return new Response('Not found', { status: 404 })

  const etag = `"${version}-${variant}"`
  if (request.headers.get('if-none-match') === etag)
    return new Response(null, {
      status: 304,
      headers: { 'Cache-Control': cacheControl, ETag: etag, Vary: 'Accept' },
    })
  const { data: image, error } = await admin.storage
    .from('pet-photos')
    .download(objectPath)
  if (error || !image)
    return new Response('Photo delivery is unavailable.', { status: 500 })
  return new Response(image, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': cacheControl,
      ETag: etag,
      Vary: 'Accept',
      'X-Content-Type-Options': 'nosniff',
    },
  })
})
