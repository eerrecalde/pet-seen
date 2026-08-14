import { createClient } from '@supabase/supabase-js'
import { contentSafetyProvider } from '../_shared/content-safety.ts'

const allowedOrigins = new Set(['https://petseen-staging.pages.dev', 'http://127.0.0.1:5173', 'http://localhost:5173'])
function corsHeaders(request: Request) { const origin = request.headers.get('origin'); const local = origin ? /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) : false; return { ...(origin && (allowedOrigins.has(origin) || local) ? { 'access-control-allow-origin': origin, vary: 'origin' } : {}), 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST, OPTIONS' } }
function response(request: Request, status: number, body: Record<string, string>) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(request), 'content-type': 'application/json' } }) }
function base64(bytes: Uint8Array) { let binary = ''; for (let start = 0; start < bytes.length; start += 0x8000) binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000)); return btoa(binary) }
async function scoreApprovedReport(url: string, serviceKey: string, reportId: string) { const result = await fetch(`${url}/functions/v1/score-found-pet-candidates`, { method: 'POST', headers: { authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'content-type': 'application/json' }, body: JSON.stringify({ reportId }) }); if (!result.ok) console.error('Automatic found-pet scoring failed', { reportId, status: result.status }) }
function wait(milliseconds: number) { return new Promise((resolve) => setTimeout(resolve, milliseconds)) }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) })
  if (request.method !== 'POST') return response(request, 405, { error: 'Method not allowed.' })
  const url = Deno.env.get('SUPABASE_URL'), serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return response(request, 500, { error: 'Screening is unavailable.' })
  const { reportId, submissionToken } = await request.json().catch(() => ({})) as { reportId?: string, submissionToken?: string }
  if (!reportId || !submissionToken) return response(request, 400, { error: 'A report and submission token are required.' })
  const admin = createClient(url, serviceKey)
  const { data: report } = await admin.from('found_pet_reports').select('id,breed,colour,details,location_description,custody_details,client_submission_id,moderation_status,photo:found_pet_photos(display_object_path)').eq('id', reportId).maybeSingle()
  if (!report || report.client_submission_id !== submissionToken) return response(request, 404, { error: 'Found-pet report not found.' })
  if (report.moderation_status !== 'pending') return response(request, 200, { status: report.moderation_status })
  try {
    const photo = Array.isArray(report.photo) ? report.photo[0] : report.photo
    let imageDataUrl: string | undefined
    if (photo?.display_object_path) {
      const { data: image, error } = await admin.storage.from('found-pet-photos').download(photo.display_object_path)
      if (error || !image) throw new Error('Processed photo is unavailable')
      const bytes = new Uint8Array(await image.arrayBuffer())
      imageDataUrl = `data:image/jpeg;base64,${base64(bytes)}`
    }
    const input = { text: [report.breed, report.colour, report.details, report.location_description, report.custody_details].filter(Boolean).join('\n'), imageDataUrl }
    let result
    try { result = await contentSafetyProvider().screen(input) } catch (firstError) {
      console.warn('Automatic found-pet screening attempt failed; retrying once', { reportId, error: firstError instanceof Error ? firstError.message : 'unknown' })
      await wait(750)
      result = await contentSafetyProvider().screen(input)
    }
    const decision = result.flagged ? 'rejected' : 'approved'
    const note = result.categories.length ? `OpenAI moderation flagged: ${result.categories.join(', ')}` : 'OpenAI moderation passed'
    await admin.from('found_pet_reports').update({ moderation_status: decision, moderated_at: new Date().toISOString(), moderated_by: null, automated_screening_note: note }).eq('id', reportId).eq('moderation_status', 'pending')
    await admin.from('found_pet_report_moderation_audit').insert({ found_pet_report_id: reportId, event: result.flagged ? 'automatically_rejected' : 'automatically_approved', automated_screening_note: note })
    if (decision === 'approved') await scoreApprovedReport(url, serviceKey, reportId)
    if (result.flagged) {
      const { data: storedPhoto } = await admin.from('found_pet_photos').select('source_object_path,display_object_path').eq('found_pet_report_id', reportId).maybeSingle()
      if (storedPhoto) await admin.storage.from('found-pet-photos').remove([storedPhoto.source_object_path, storedPhoto.display_object_path].filter(Boolean))
      await admin.from('found_pet_report_moderation_audit').insert({ found_pet_report_id: reportId, event: 'rejected_files_deleted' })
      await admin.from('found_pet_reports').delete().eq('id', reportId)
    }
    return response(request, 200, { status: decision })
  } catch (error) {
    console.error('Found-pet report screening failed', error)
    const note = 'Automatic safety screening could not complete. This report needs staff review.'
    await admin.from('found_pet_reports').update({ automated_screening_note: note }).eq('id', reportId).eq('moderation_status', 'pending')
    await admin.from('found_pet_report_moderation_audit').insert({ found_pet_report_id: reportId, event: 'automatic_screening_failed', automated_screening_note: note, metadata: { stage: 'automatic_screening' } })
    return response(request, 202, { status: 'pending' })
  }
})
