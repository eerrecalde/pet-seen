import { createClient } from '@supabase/supabase-js'

const allowedOrigins = new Set(['https://petseen-staging.pages.dev', 'http://127.0.0.1:5173', 'http://localhost:5173'])
function corsHeaders(request: Request) { const origin = request.headers.get('origin'); const local = origin ? /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) : false; return { ...(origin && (allowedOrigins.has(origin) || local) ? { 'access-control-allow-origin': origin, vary: 'origin' } : {}), 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST, OPTIONS' } }
function response(request: Request, status: number, body: Record<string, unknown>) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(request), 'content-type': 'application/json' } }) }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) })
  if (request.method !== 'POST') return response(request, 405, { error: 'Method not allowed.' })
  const url = Deno.env.get('SUPABASE_URL'), serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!url || !serviceKey || !token) return response(request, 401, { error: 'Authorisation is required.' })
  const admin = createClient(url, serviceKey)
  const scheduled = token === serviceKey
  if (!scheduled) {
    const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { authorization: `Bearer ${token}` } } })
    const { data: allowed } = await user.rpc('is_authorized_staff')
    if (allowed !== true) return response(request, 403, { error: 'Only Pet Seen staff can run housekeeping.' })
  }
  const { data: expired, error: expiryError } = await admin.rpc('expire_stale_found_pet_reports')
  if (expiryError) return response(request, 502, { error: expiryError.message })
  const { data: due, error: dueError } = await admin.rpc('found_pet_reports_due_for_retention_cleanup')
  if (dueError) return response(request, 502, { error: dueError.message })
  let removed = 0
  for (const report of due ?? []) {
    const paths = [report.source_object_path, report.display_object_path].filter((path): path is string => Boolean(path))
    if (paths.length) {
      const { error } = await admin.storage.from('found-pet-photos').remove(paths)
      if (error) return response(request, 502, { error: `Retention cleanup stopped: ${error.message}` })
      await admin.from('found_pet_report_moderation_audit').insert({ found_pet_report_id: report.report_id, event: 'retention_files_deleted' })
    }
    await admin.from('found_pet_report_moderation_audit').insert({ found_pet_report_id: report.report_id, event: 'retention_deleted' })
    const { error } = await admin.from('found_pet_reports').delete().eq('id', report.report_id)
    if (error) return response(request, 502, { error: `Retention cleanup stopped: ${error.message}` })
    removed += 1
  }
  return response(request, 200, { expired: expired ?? 0, removed })
})
