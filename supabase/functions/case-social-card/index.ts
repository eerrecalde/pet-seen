// Public Open Graph card. It deliberately reads only the public projection,
// so a crawler can never receive exact coordinates or owner data.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character))

Deno.serve(async (request) => {
  const slug = new URL(request.url).searchParams.get('slug')
  if (!slug || !/^[a-z0-9]{10,32}$/.test(slug)) return new Response('Not found', { status: 404 })
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data } = await client.from('public_missing_cases').select('pet_name,species,breed,colour,last_seen_description').eq('public_slug', slug).maybeSingle()
  if (!data) return new Response('Not found', { status: 404 })
  const petName = escape(data.pet_name); const details = escape([data.colour, data.breed].filter(Boolean).join(' · ') || data.species); const area = escape(data.last_seen_description || 'Approximate area')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#fff7ed"/><circle cx="1020" cy="110" r="230" fill="#dfeedd"/><path d="M150 173c-38 0-69 31-69 69s31 69 69 69 69-31 69-69-31-69-69-69Zm0 36c18 0 33 15 33 33s-15 33-33 33-33-15-33-33 15-33 33-33Z" fill="#d76f4e"/><text x="92" y="110" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="#5f4031">PET SEEN</text><text x="92" y="390" font-family="Arial,sans-serif" font-size="92" font-weight="700" fill="#3d2b21">${petName} is missing</text><text x="96" y="468" font-family="Arial,sans-serif" font-size="38" fill="#725e50">${details}</text><text x="96" y="525" font-family="Arial,sans-serif" font-size="31" fill="#47724a">Approximate area: ${area}</text></svg>`
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' } })
})
