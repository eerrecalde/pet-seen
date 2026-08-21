import {
  getSupabaseClient,
  unwrapSupabaseResult,
} from '../../lib/supabase-error'
import { enablePushNotifications } from '../../lib/push-notifications'

export type OwnerCaseStatus =
  'draft' | 'published' | 'closed' | 'reunited' | 'removed' | 'expired'
export type OwnerCase = {
  id: string
  public_slug: string
  status: OwnerCaseStatus
  title: string | null
  last_seen_at: string | null
  last_seen_description: string | null
  closed_at: string | null
  published_at: string | null
  reunion_reason:
    | 'returned_home'
    | 'found_by_neighbour'
    | 'seen_after_report'
    | 'other'
    | null
  reunion_pet_seen_attributed: boolean | null
  pet: {
    id: string
    name: string
    species: 'dog' | 'cat'
    breed: string | null
    colour: string | null
    description: string | null
    pet_photos?: {
      display_object_path: string | null
      status: 'pending' | 'processed' | 'failed'
    }[]
  } | null
}
export type OwnerSighting = {
  id: string
  case_id: string | null
  seen_at: string
  location_description: string | null
  details: string | null
  report_status: 'pending' | 'confirmed' | 'dismissed'
  latitude: number
  longitude: number
  label: string
}
export type FoundMatch = {
  found_pet_report_id: string
  case_id: string
  match_score: number
  match_reasons: string[]
  status: 'pending_owner' | 'confirmed'
  report: {
    species: 'dog' | 'cat'
    breed: string | null
    colour: string | null
    details: string
    custody_status: 'with_reporter' | 'with_vet_or_rescue' | 'not_in_custody'
    found_at: string
    location_description: string | null
    photo: { display_object_path: string | null } | null
  } | null
}
export type WatchArea = { id: string; label: string; radius_metres: number }

export async function fetchOwnerDashboard(userId: string) {
  const client = getSupabaseClient()
  const data = await unwrapSupabaseResult(
    client
      .from('missing_cases')
      .select(
        'id,public_slug,status,title,last_seen_at,last_seen_description,closed_at,published_at,reunion_reason,reunion_pet_seen_attributed,pet:pets(id,name,species,breed,colour,description,pet_photos(display_object_path,status))',
      )
      .eq('owner_id', userId)
      .order('created_at', { ascending: false }),
    'We could not load your cases.',
  )
  const cases = (data ?? []).map((item) => ({
    ...item,
    pet: Array.isArray(item.pet) ? (item.pet[0] ?? null) : item.pet,
  })) as OwnerCase[]
  const ids = cases.map((item) => item.id)
  if (!ids.length)
    return {
      cases,
      sightings: [] as OwnerSighting[],
      foundMatches: [] as FoundMatch[],
    }
  const [sightings, matches] = await Promise.all([
    unwrapSupabaseResult(
      client
        .from('owner_case_sightings')
        .select(
          'id,case_id,seen_at,location_description,details,report_status,latitude,longitude',
        )
        .in('case_id', ids)
        .order('seen_at', { ascending: false }),
      'We could not load sightings.',
    ),
    unwrapSupabaseResult(
      client
        .from('found_pet_case_links')
        .select(
          'found_pet_report_id,case_id,match_score,match_reasons,status,report:found_pet_reports(species,breed,colour,details,custody_status,found_at,location_description,photo:found_pet_photos(display_object_path))',
        )
        .in('case_id', ids)
        .in('status', ['pending_owner', 'confirmed']),
      'We could not load found-pet matches.',
    ),
  ])
  return {
    cases,
    sightings: (sightings ?? []).map((item) => ({
      ...item,
      latitude: Number(item.latitude),
      longitude: Number(item.longitude),
      label: item.location_description || 'Reported sighting',
    })) as OwnerSighting[],
    foundMatches: (matches ?? []).map((item) => {
      const report = Array.isArray(item.report)
        ? (item.report[0] ?? null)
        : item.report
      return report
        ? {
            ...item,
            report: {
              ...report,
              photo: Array.isArray(report.photo)
                ? (report.photo[0] ?? null)
                : report.photo,
            },
          }
        : { ...item, report: null }
    }) as unknown as FoundMatch[],
  }
}

export async function fetchWatchAreas(userId: string) {
  const client = getSupabaseClient()
  return ((await unwrapSupabaseResult(
    client
      .from('watch_areas')
      .select('id,label,radius_metres')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false }),
    'We could not load watch areas.',
  )) ?? []) as WatchArea[]
}
export async function fetchSignedPetPhoto(path: string) {
  const client = getSupabaseClient()
  const data = await unwrapSupabaseResult(
    client.storage.from('pet-photos').createSignedUrl(path, 60 * 60),
    'We could not load this photo.',
  )
  return data?.signedUrl ?? ''
}
export async function fetchSignedFoundPetPhoto(path: string) {
  const client = getSupabaseClient()
  const data = await unwrapSupabaseResult(
    client.storage.from('found-pet-photos').createSignedUrl(path, 10 * 60),
    'We could not load this photo.',
  )
  return data?.signedUrl ?? ''
}
export async function enableOwnerPushNotifications(vapidKey: string) {
  await enablePushNotifications(getSupabaseClient(), vapidKey)
}

export async function updateOwnerCase(input: {
  userId: string
  caseId: string
  petId: string
  fields: Record<string, string>
}) {
  const client = getSupabaseClient()
  const pet = await client
    .from('pets')
    .update({
      name: input.fields.name.trim(),
      breed: input.fields.breed.trim() || null,
      colour: input.fields.colour.trim() || null,
      description: input.fields.description.trim() || null,
    })
    .eq('id', input.petId)
    .eq('owner_id', input.userId)
  if (pet.error) throw pet.error
  const caseUpdate = await client
    .from('missing_cases')
    .update({
      title: input.fields.title.trim() || null,
      last_seen_description: input.fields.place.trim() || null,
      last_seen_at: input.fields.lastSeenAt
        ? new Date(input.fields.lastSeenAt).toISOString()
        : null,
    })
    .eq('id', input.caseId)
    .eq('owner_id', input.userId)
  if (caseUpdate.error) throw caseUpdate.error
}
export async function setOwnerCaseStatus(input: {
  userId: string
  caseId: string
  status: 'published' | 'closed' | 'reunited'
  publishedAt: string | null
  reunion?: { reason: string; attributed: boolean }
}) {
  const client = getSupabaseClient()
  const updates =
    input.status === 'published'
      ? {
          status: input.status,
          closed_at: null,
          published_at: input.publishedAt ?? new Date().toISOString(),
          reunion_reason: null,
          reunion_pet_seen_attributed: null,
        }
      : input.status === 'reunited' && input.reunion
        ? {
            status: input.status,
            closed_at: new Date().toISOString(),
            reunion_reason: input.reunion.reason,
            reunion_pet_seen_attributed: input.reunion.attributed,
          }
        : { status: input.status, closed_at: new Date().toISOString() }
  await unwrapSupabaseResult(
    client
      .from('missing_cases')
      .update(updates)
      .eq('id', input.caseId)
      .eq('owner_id', input.userId),
    'We could not update this case.',
  )
}
export async function deleteOwnerCase(input: {
  userId: string
  caseId: string
}) {
  const client = getSupabaseClient()
  await unwrapSupabaseResult(
    client
      .from('missing_cases')
      .delete()
      .eq('id', input.caseId)
      .eq('owner_id', input.userId),
    'We could not remove this case.',
  )
}
export async function reviewOwnerSighting(input: {
  sightingId: string
  status: 'confirmed' | 'dismissed'
}) {
  const client = getSupabaseClient()
  await unwrapSupabaseResult(
    client.rpc('review_sighting', {
      target_sighting_id: input.sightingId,
      next_status: input.status,
    }),
    'We could not update this sighting.',
  )
}
export async function reviewFoundMatch(input: {
  reportId: string
  caseId: string
  decision: 'confirmed' | 'declined'
}) {
  const client = getSupabaseClient()
  await unwrapSupabaseResult(
    client.rpc('review_found_pet_match', {
      target_report_id: input.reportId,
      target_case_id: input.caseId,
      decision: input.decision,
    }),
    'We could not update this found-pet match.',
  )
}
export async function createWatchArea(input: {
  userId: string
  label: string
  radius: number
  latitude: number
  longitude: number
}) {
  const client = getSupabaseClient()
  await unwrapSupabaseResult(
    client.from('watch_areas').insert({
      owner_id: input.userId,
      label: input.label,
      radius_metres: input.radius,
      centre: `POINT(${input.longitude} ${input.latitude})`,
    }),
    'We could not save that watch area.',
  )
}
export async function deleteWatchArea(id: string) {
  const client = getSupabaseClient()
  await unwrapSupabaseResult(
    client.from('watch_areas').delete().eq('id', id),
    'We could not remove that watch area.',
  )
}
export async function sendFoundPetMessage(input: {
  reportId: string
  body: string
}) {
  const client = getSupabaseClient()
  await unwrapSupabaseResult(
    client.rpc('send_found_pet_message', {
      target_report_id: input.reportId,
      message_body: input.body,
    }),
    'We could not send your message.',
  )
}
