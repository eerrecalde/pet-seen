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

/**
 * Hosted Edge Functions expose current secret keys as a JSON dictionary.
 * Keep the legacy fallback so the tracked local Supabase environment continues
 * to work while it still provides SUPABASE_SERVICE_ROLE_KEY.
 */
function adminKey() {
  const currentKeys = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (currentKeys) {
    try {
      const keys = JSON.parse(currentKeys)
      const key =
        (typeof keys?.geocodelocation === 'string' &&
          keys.geocodelocation) ||
        (typeof keys?.default === 'string' && keys.default)
      if (key) return key
    } catch (error) {
      console.error('Could not parse Supabase secret keys', error)
    }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
}

async function databaseRequest(
  url: string,
  key: string,
  path: string,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers)
  headers.delete('authorization')
  headers.set('apikey', key)
  return fetch(`${url}/rest/v1/${path}`, { ...init, headers })
}

async function databaseError(response: Response) {
  return (await response.json().catch(() => ({}))) as {
    code?: string
    details?: string | null
    hint?: string | null
    message?: string
  }
}

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
    headers: {
      ...cors(request),
      'content-type': 'application/json',
    },
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
  const serviceRoleKey = adminKey()
  const providerKey = Deno.env.get('GEOAPIFY_GEOCODING_API_KEY')
  if (!url || !serviceRoleKey || !providerKey) {
    console.error('Geocoding configuration unavailable', {
      hasAdminKey: Boolean(serviceRoleKey),
      hasProviderKey: Boolean(providerKey),
      hasUrl: Boolean(url),
    })
    return response(request, 503, {
      error: 'Place search is temporarily unavailable.',
    })
  }
  const now = new Date().toISOString()
  const cacheResponse = await databaseRequest(
    url,
    serviceRoleKey,
    `geocoding_query_cache?select=results&normalized_query=eq.${encodeURIComponent(query)}&expires_at=gt.${encodeURIComponent(now)}`,
  )
  if (!cacheResponse.ok) {
    const cacheReadError = await databaseError(cacheResponse)
    console.error('Could not read geocoding cache', cacheReadError)
    return response(request, 503, {
      error: 'Place search is temporarily unavailable.',
    })
  }
  const [cached] = (await cacheResponse.json()) as Array<{
    results: PlaceResult[]
  }>
  if (cached)
    return response(request, 200, { results: cached.results, cached: true })

  const rateResponse = await databaseRequest(
    url,
    serviceRoleKey,
    'rpc/take_geocoding_request_slot',
    {
      body: JSON.stringify({ p_requester_key: await clientKey(request) }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    },
  )
  if (!rateResponse.ok) {
    const rateError = await databaseError(rateResponse)
    console.error('Could not take geocoding request slot', rateError)
    return response(request, 503, {
      error: 'Place search is temporarily unavailable.',
    })
  }
  const allowed = (await rateResponse.json()) as boolean
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
    const cacheWriteResponse = await databaseRequest(
      url,
      serviceRoleKey,
      'geocoding_query_cache?on_conflict=normalized_query',
      {
        body: JSON.stringify({
          normalized_query: query,
          results,
          expires_at: expiresAt,
          updated_at: now,
        }),
        headers: {
          'content-type': 'application/json',
          prefer: 'resolution=merge-duplicates,return=minimal',
        },
        method: 'POST',
      },
    )
    if (!cacheWriteResponse.ok)
      console.error(
        'Could not cache geocoding result',
        await databaseError(cacheWriteResponse),
      )
    return response(request, 200, { results, cached: false })
  } catch (error) {
    console.error('Geoapify geocoding failed', error)
    return response(request, 502, {
      error:
        'We could not search for that place. You can still choose a point on the map.',
    })
  }
})
