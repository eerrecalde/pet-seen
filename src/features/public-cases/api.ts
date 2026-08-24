import {
  getSupabaseClient,
  unwrapSupabaseResult,
} from '../../lib/supabase-error'
import type {
  ContentReportReason,
  NearbyCase,
  NearbySighting,
  PublicCase,
  PublicCaseOption,
  ShareChannel,
} from './types'

const publicCaseFields =
  'public_slug,title,last_seen_at,last_seen_description,pet_name,species,breed,colour,pet_description,public_latitude,public_longitude,photo_version'

/** Only public-safe views are selected by this feature boundary. */
export async function fetchPublicCase(
  slug: string,
): Promise<PublicCase | null> {
  const client = getSupabaseClient()
  return unwrapSupabaseResult(
    client
      .from('public_missing_cases')
      .select(publicCaseFields)
      .eq('public_slug', slug)
      .maybeSingle(),
    'We could not load this case.',
  ) as Promise<PublicCase | null>
}

export async function fetchNearbyDiscovery(
  latitude: number,
  longitude: number,
): Promise<{
  cases: NearbyCase[]
  sightings: NearbySighting[]
}> {
  const client = getSupabaseClient()
  const [cases, sightings] = await Promise.all([
    unwrapSupabaseResult(
      client.rpc('find_public_nearby_cases', {
        search_latitude: latitude,
        search_longitude: longitude,
      }),
      'We could not load nearby cases.',
    ),
    unwrapSupabaseResult(
      client.rpc('find_public_nearby_sightings', {
        search_latitude: latitude,
        search_longitude: longitude,
      }),
      'We could not load nearby sightings.',
    ),
  ])
  return {
    cases: (cases ?? []) as NearbyCase[],
    sightings: (sightings ?? []) as NearbySighting[],
  }
}

export async function fetchPublicCaseOptions(): Promise<PublicCaseOption[]> {
  const client = getSupabaseClient()
  const data = await unwrapSupabaseResult(
    client
      .from('public_missing_cases')
      .select('public_slug,pet_name,species,breed,colour,last_seen_description')
      .order('published_at', { ascending: false })
      .limit(50),
    'We could not load missing-pet cases.',
  )
  return (data ?? []) as PublicCaseOption[]
}

export async function recordShareAttribution(slug: string, token: string) {
  const client = getSupabaseClient()
  await unwrapSupabaseResult(
    client.rpc('record_share_attribution', {
      case_slug: slug,
      share_token: token,
    }),
    'We could not record this share.',
  )
}

export async function createShareAttribution(
  slug: string,
  channel: ShareChannel,
): Promise<string | null> {
  const client = getSupabaseClient()
  return unwrapSupabaseResult(
    client.rpc('create_share_attribution', {
      case_slug: slug,
      share_channel: channel,
    }),
    'We could not create a share link.',
  )
}

export async function submitContentReport(input: {
  slug: string
  reason: ContentReportReason
  details: string
}) {
  const client = getSupabaseClient()
  await unwrapSupabaseResult(
    client.rpc('submit_content_report', {
      case_slug: input.slug,
      report_reason: input.reason,
      report_details: input.details || null,
    }),
    'We could not send your report.',
  )
}
