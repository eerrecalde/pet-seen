import { createClient } from 'npm:@supabase/supabase-js@2'

const maxPhotoBytes = 5 * 1024 * 1024
const allowedOrigins = new Set([
  'https://petseen-staging.pages.dev',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
])
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
function decodePhoto(photo: string | null | undefined) {
  if (!photo) return null
  const bytes = Uint8Array.from(atob(photo), (character) =>
    character.charCodeAt(0),
  )
  if (
    !bytes.byteLength ||
    bytes.byteLength > maxPhotoBytes ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8
  )
    throw new Error('Choose a JPG or PNG image no larger than 5 MB.')
  return bytes
}
async function invoke(
  url: string,
  serviceKey: string,
  name: string,
  body: Record<string, unknown>,
  authorization?: string | null,
) {
  const result = await fetch(`${url}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      authorization: authorization || `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'content-type': 'application/json',
      'x-petseen-internal': serviceKey,
    },
    body: JSON.stringify(body),
  })
  if (!result.ok)
    throw new Error((await result.text()).slice(0, 500) || `${name} failed`)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: cors(request) })
  if (request.method !== 'POST')
    return response(request, 405, { error: 'Method not allowed.' })
  const url = Deno.env.get('SUPABASE_URL'),
    serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !serviceKey || !anonKey)
    return response(request, 500, { error: 'Submission is unavailable.' })
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null
  if (!body || typeof body.kind !== 'string')
    return response(request, 400, { error: 'A submission is required.' })
  const authorization = request.headers.get('authorization')
  const accessToken = authorization?.replace(/^Bearer\s+/i, '') ?? ''
  const userClient = createClient(url, anonKey, {
    global: {
      headers: { Authorization: accessToken ? `Bearer ${accessToken}` : '' },
    },
  })
  const admin = createClient(url, serviceKey)
  try {
    if (body.kind === 'sighting') {
      const { data: sightingId, error } = await userClient.rpc(
        'submit_sighting',
        body.payload as Record<string, unknown>,
      )
      if (error || !sightingId)
        throw new Error(error?.message || 'We could not send your sighting.')
      // The outbox is already committed by the sighting trigger. Deliver now
      // when possible; retries remain available after this request ends.
      try {
        await invoke(url, serviceKey, 'deliver-workflow-outbox', {})
      } catch (deliveryError) {
        console.error('Outbox delivery will retry', deliveryError)
      }
      return response(request, 200, { id: sightingId })
    }
    if (body.kind === 'found') {
      const payload = body.payload as Record<string, unknown>
      const { data: reportId, error } = await userClient.rpc(
        'submit_found_pet_report',
        payload,
      )
      if (error || !reportId)
        throw new Error(error?.message || 'We could not send your report.')
      const photo = decodePhoto(body.photo as string | null)
      if (photo) {
        const token = String(payload.submission_token)
        const sourcePath = `source/${reportId}.jpg`
        let photoId: string | null = null
        try {
          const { error: uploadError } = await admin.storage
            .from('found-pet-photos')
            .upload(sourcePath, photo, {
              contentType: 'image/jpeg',
              upsert: false,
            })
          if (uploadError && !/already exists/i.test(uploadError.message))
            throw uploadError
          const { data, error: attachError } = await userClient.rpc(
            'attach_found_pet_photo',
            { target_report_id: reportId, submission_token: token },
          )
          photoId = data
          if (attachError || !photoId)
            throw new Error(
              attachError?.message || 'We could not add the photo.',
            )
          await invoke(url, serviceKey, 'process-pet-photo', {
            foundPhotoId: photoId,
            foundSubmissionToken: token,
          })
        } catch (photoError) {
          if (photoId)
            await admin.from('found_pet_photos').delete().eq('id', photoId)
          await admin.storage.from('found-pet-photos').remove([sourcePath])
          throw photoError
        }
      }
      await invoke(url, serviceKey, 'screen-found-pet-report', {
        reportId,
        submissionToken: String(payload.submission_token),
      })
      return response(request, 200, { id: reportId })
    }
    if (body.kind === 'missing_case_draft') {
      const payload = body.payload as Record<string, unknown>
      const { data: auth } = accessToken
        ? await userClient.auth.getUser(accessToken)
        : { data: { user: null } }
      if (!auth.user)
        return response(request, 401, { error: 'Sign in is required.' })
      const { data: draft, error } = await userClient.rpc(
        'create_missing_case_draft',
        payload,
      )
      const row = Array.isArray(draft) ? draft[0] : draft
      if (error || !row)
        throw new Error(error?.message || 'We could not save your pet.')
      const photo = decodePhoto(body.photo as string | null)
      if (photo) {
        const sourcePath = `${auth.user.id}/source/${crypto.randomUUID()}.jpg`
        try {
          const { error: uploadError } = await admin.storage
            .from('pet-photos')
            .upload(sourcePath, photo, {
              contentType: 'image/jpeg',
              upsert: false,
            })
          if (uploadError) throw uploadError
          const { data: photoRow, error: photoError } = await admin
            .from('pet_photos')
            .insert({
              pet_id: row.pet_id,
              owner_id: auth.user.id,
              source_object_path: sourcePath,
            })
            .select('id')
            .single()
          if (photoError || !photoRow)
            throw new Error(
              photoError?.message || 'We could not save the photo.',
            )
          await invoke(
            url,
            serviceKey,
            'process-pet-photo',
            { photoId: photoRow.id },
            authorization,
          )
        } catch (photoError) {
          await admin.storage.from('pet-photos').remove([sourcePath])
          await userClient.rpc('discard_missing_case_draft', {
            target_case_id: row.case_id,
          })
          throw photoError
        }
      }
      return response(request, 200, { id: row.case_id, petId: row.pet_id })
    }
    if (body.kind === 'missing_case_discard') {
      const caseId = String(body.caseId ?? '')
      const { data: auth } = accessToken
        ? await userClient.auth.getUser(accessToken)
        : { data: { user: null } }
      if (!auth.user || !caseId)
        return response(request, 401, { error: 'Sign in is required.' })
      const { data: caseRow } = await admin
        .from('missing_cases')
        .select('pet_id')
        .eq('id', caseId)
        .eq('owner_id', auth.user.id)
        .eq('status', 'draft')
        .maybeSingle<{ pet_id: string }>()
      if (!caseRow)
        return response(request, 404, { error: 'Draft case not found.' })
      const { data: photos } = await admin
        .from('pet_photos')
        .select('source_object_path,display_object_path')
        .eq('pet_id', caseRow.pet_id)
        .eq('owner_id', auth.user.id)
      const { error } = await userClient.rpc('discard_missing_case_draft', {
        target_case_id: caseId,
      })
      if (error) throw new Error(error.message)
      const paths = (photos ?? []).flatMap((photo) =>
        [photo.source_object_path, photo.display_object_path].filter(
          (path): path is string => Boolean(path),
        ),
      )
      if (paths.length) {
        const { error: storageError } = await admin.storage
          .from('pet-photos')
          .remove(paths)
        if (storageError)
          console.error(
            'Could not remove discarded pet photo files',
            storageError,
          )
      }
      return response(request, 200, { status: 'discarded' })
    }
    return response(request, 400, { error: 'Unknown submission.' })
  } catch (cause) {
    return response(request, 422, {
      error:
        cause instanceof Error
          ? cause.message
          : 'We could not save your submission.',
    })
  }
})
