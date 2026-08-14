import { createClient } from '@supabase/supabase-js'

const allowedOrigins = new Set(['https://petseen-staging.pages.dev', 'http://127.0.0.1:5173', 'http://localhost:5173'])
function corsHeaders(request: Request) { const origin = request.headers.get('origin'); const local = origin ? /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) : false; return { ...(origin && (allowedOrigins.has(origin) || local) ? { 'access-control-allow-origin': origin, vary: 'origin' } : {}), 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST, OPTIONS' } }
function response(request: Request, status: number, body: Record<string, string>) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(request), 'content-type': 'application/json' } }) }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) })
  if (request.method !== 'POST') return response(request, 405, { error: 'Method not allowed.' })
  const url = Deno.env.get('SUPABASE_URL'), serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!url || !serviceKey || !token) return response(request, 401, { error: 'Sign in is required.' })
  const { reportId, action, reason } = await request.json().catch(() => ({})) as { reportId?: string, action?: 'resolved' | 'expired' | 'reopen' | 'delete', reason?: string }
  if (!reportId || !action || !['resolved', 'expired', 'reopen', 'delete'].includes(action)) return response(request, 400, { error: 'A report and valid action are required.' })
  const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { authorization: `Bearer ${token}` } } })
  const { data: allowed } = await user.rpc('is_authorized_staff')
  if (allowed !== true) return response(request, 403, { error: 'Only Pet Seen staff can manage reports.' })
  if (action !== 'delete') {
    const status = action === 'reopen' ? 'active' : action
    const { error } = await user.rpc('set_found_pet_report_lifecycle', { target_report_id: reportId, next_status: status, reason: action === 'reopen' ? null : reason?.trim() || null })
    if (error) return response(request, 400, { error: error.message })
    return response(request, 200, { status })
  }
  const admin = createClient(url, serviceKey)
  const { data: photo, error: photoError } = await admin.from('found_pet_photos').select('source_object_path,display_object_path').eq('found_pet_report_id', reportId).maybeSingle()
  if (photoError) return response(request, 502, { error: photoError.message })
  const paths = [photo?.source_object_path, photo?.display_object_path].filter((path): path is string => Boolean(path))
  if (paths.length) {
    const { error } = await admin.storage.from('found-pet-photos').remove(paths)
    if (error) return response(request, 502, { error: 'Report files could not be deleted.' })
    await admin.from('found_pet_report_moderation_audit').insert({ found_pet_report_id: reportId, event: 'deleted_files_deleted' })
  }
  await admin.from('found_pet_report_moderation_audit').insert({ found_pet_report_id: reportId, event: 'deleted', metadata: { reason: reason?.trim() || 'staff_cleanup' } })
  const { error } = await admin.from('found_pet_reports').delete().eq('id', reportId)
  if (error) return response(request, 502, { error: 'Report content could not be deleted.' })
  return response(request, 200, { status: 'deleted' })
})
