import { createClient } from '@supabase/supabase-js'

const allowedOrigins = new Set([
  'https://petseen-staging.pages.dev',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
])
function corsHeaders(request: Request) {
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
  body: Record<string, string>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'content-type': 'application/json' },
  })
}
async function scoreApprovedReport(
  url: string,
  serviceKey: string,
  reportId: string,
) {
  const result = await fetch(`${url}/functions/v1/score-found-pet-candidates`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'content-type': 'application/json',
      'x-petseen-internal': serviceKey,
    },
    body: JSON.stringify({ reportId }),
  })
  if (!result.ok)
    console.error('Automatic found-pet scoring failed', {
      reportId,
      status: result.status,
    })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: corsHeaders(request) })
  if (request.method !== 'POST')
    return response(request, 405, { error: 'Method not allowed.' })
  const url = Deno.env.get('SUPABASE_URL'),
    serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!url || !serviceKey || !token)
    return response(request, 401, { error: 'Sign in is required.' })
  const { reportId, decision } = (await request.json().catch(() => ({}))) as {
    reportId?: string
    decision?: 'approved' | 'rejected'
  }
  if (!reportId || !['approved', 'rejected'].includes(decision ?? ''))
    return response(request, 400, {
      error: 'A report and decision are required.',
    })
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { authorization: `Bearer ${token}` } },
  })
  const { data: allowed } = await userClient.rpc('is_authorized_staff')
  if (allowed !== true)
    return response(request, 403, {
      error: 'Only Pet Seen staff can moderate reports.',
    })
  const admin = createClient(url, serviceKey)
  if (decision === 'rejected') {
    const { data: photo } = await admin
      .from('found_pet_photos')
      .select('source_object_path,display_object_path')
      .eq('found_pet_report_id', reportId)
      .maybeSingle()
    if (photo) {
      const paths = [
        photo.source_object_path,
        photo.display_object_path,
      ].filter(Boolean)
      const { error } = await admin.storage
        .from('found-pet-photos')
        .remove(paths)
      if (error)
        return response(request, 502, {
          error: 'Rejected photo files could not be deleted.',
        })
    }
  }
  const { error } = await userClient.rpc('review_found_pet_report', {
    target_report_id: reportId,
    decision,
  })
  if (error) return response(request, 400, { error: error.message })
  if (decision === 'approved')
    await scoreApprovedReport(url, serviceKey, reportId)
  if (decision === 'rejected') {
    await admin.from('found_pet_report_moderation_audit').insert({
      found_pet_report_id: reportId,
      event: 'rejected_files_deleted',
    })
    const { error: deleteError } = await admin
      .from('found_pet_reports')
      .delete()
      .eq('id', reportId)
    if (deleteError)
      return response(request, 502, {
        error: 'Rejected report content could not be deleted.',
      })
  }
  return response(request, 200, { status: decision })
})
