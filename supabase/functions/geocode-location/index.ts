import { createClient } from 'npm:@supabase/supabase-js@2'

const allowedOrigins = new Set([
  'https://petseen-staging.pages.dev',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
])
const cacheTtlHours = 24

type ProviderResult = {
  formatted?: string
  lat?: unknown
  lon?: unknown
}
type PlaceResult = { label: string; latitude: number; longitude: number }

function cors(request: Request) {
  const origin = request.headers.get('origin')
  const local = origin
    ? /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
    : false
  return {
    ...(origin && (allowedOrigins.has(origin) || local)
      ? { 'access-control-allow-origin': origin, vary: 'origin' }
      : {}),
    'access-control-allow-headers':
      'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
  }
}
function response(
  request: Request,
  status: number,
  body: Record<string, unknown>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(request), 'content-type': 'application/json' },
  })
}
function normaliseQuery(value: string) {
  return value.trim().toLocaleLowerCase('en-GB').replace(/\s+/g, ' ')
}
function clientKey(request: Request) {
  const forwarded = request.headers
    .get('x-forwarded-for')
    ?.split(',')[0]
    ?.trim()
  return crypto.subtle
    .digest('SHA-256', new TextEncoder().encode(forwarded || 'unknown'))
    .then((bytes) =>
      [...new Uint8Array(bytes)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join(''),
    )
}
function resultsFrom(results: ProviderResult[]): PlaceResult[] {
  return results
    .map((result) => ({
      label: result.formatted || '',
      latitude: Number(result.lat),
      longitude: Number(result.lon),
    }))
    .filter(
      (place) =>
        place.label &&
        Number.isFinite(place.latitude) &&
        Number.isFinite(place.longitude),
    )
    .slice(0, 5)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: cors(request) })
  if (request.method !== 'POST')
    return response(request, 405, { error: 'Method not allowed.' })

  const rawQuery = (await request.json().catch(() => null))?.query
  if (typeof rawQuery !== 'string')
    return response(request, 400, { error: 'Enter a postcode or place.' })
  const query = normaliseQuery(rawQuery)
  if (query.length < 3 || query.length > 200)
    return response(request, 400, {
      error: 'Enter a postcode or place between 3 and 200 characters.',
    })

  const url = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const providerKey = Deno.env.get('GEOAPIFY_GEOCODING_API_KEY')
  if (!url || !serviceRoleKey || !providerKey)
    return response(request, 503, {
      error: 'Place search is temporarily unavailable.',
    })
  const admin = createClient(url, serviceRoleKey)
  const now = new Date().toISOString()
  const { data: cached } = await admin
    .from('geocoding_query_cache')
    .select('results')
    .eq('normalized_query', query)
    .gt('expires_at', now)
    .maybeSingle()
  if (cached)
    return response(request, 200, { results: cached.results, cached: true })

  const { data: allowed, error: rateError } = await admin.rpc(
    'take_geocoding_request_slot',
    { p_requester_key: await clientKey(request) },
  )
  if (rateError)
    return response(request, 503, {
      error: 'Place search is temporarily unavailable.',
    })
  if (!allowed)
    return response(request, 429, {
      error: 'Too many place searches. You can still place the pin on the map.',
    })

  try {
    const providerUrl = new URL('https://api.geoapify.com/v1/geocode/search')
    providerUrl.search = new URLSearchParams({
      text: query,
      limit: '5',
      format: 'json',
      filter: 'countrycode:gb',
      apiKey: providerKey,
    }).toString()
    const providerResponse = await fetch(providerUrl)
    if (!providerResponse.ok)
      throw new Error(`Geoapify returned ${providerResponse.status}`)
    const payload = (await providerResponse.json()) as {
      results?: ProviderResult[]
    }
    const results = resultsFrom(payload.results ?? [])
    const expiresAt = new Date(
      Date.now() + cacheTtlHours * 60 * 60 * 1000,
    ).toISOString()
    const { error: cacheError } = await admin
      .from('geocoding_query_cache')
      .upsert({
        normalized_query: query,
        results,
        expires_at: expiresAt,
        updated_at: now,
      })
    if (cacheError)
      console.error('Could not cache geocoding result', cacheError)
    return response(request, 200, { results, cached: false })
  } catch (error) {
    console.error('Geoapify geocoding failed', error)
    return response(request, 502, {
      error:
        'We could not search for that place. You can still choose a point on the map.',
    })
  }
})
