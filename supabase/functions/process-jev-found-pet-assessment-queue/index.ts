import { createClient } from '@supabase/supabase-js'

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return reply(405, { error: 'Method not allowed.' })
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!url || !serviceKey || token !== serviceKey) return reply(401, { error: 'Service role required.' })
  const admin = createClient(url, serviceKey)
  const { data: jobs, error } = await admin.rpc('claim_jev_found_pet_assessment_jobs', { max_jobs: 1 })
  if (error) return reply(500, { error: 'Could not claim Jev assessment work.' })
  for (const job of jobs ?? []) {
    const result = await fetch(`${url}/functions/v1/assess-jev-found-pet-candidates`, {
      method: 'POST', headers: { authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'content-type': 'application/json' },
      body: JSON.stringify({ reportId: job.found_pet_report_id, queueId: job.id }),
    })
    const payload = await result.json().catch(() => ({})) as { error?: string; outcome?: string; retryable?: boolean }
    if (result.ok) {
      await admin.from('jev_found_pet_assessment_queue').update({ status: payload.outcome?.startsWith('skipped') ? 'skipped' : 'completed', completed_at: new Date().toISOString(), leased_until: null, last_error: null }).eq('id', job.id)
      continue
    }
    const message = (payload.error ?? `Jev worker returned ${result.status}`).slice(0, 240)
    const retry = payload.retryable && job.attempts < 3
    await admin.from('jev_found_pet_assessment_queue').update(retry ? {
      status: 'pending', available_at: new Date(Date.now() + Math.min(900_000, 60_000 * 2 ** job.attempts)).toISOString(), leased_until: null, last_error: message,
    } : { status: 'failed', completed_at: new Date().toISOString(), leased_until: null, last_error: message }).eq('id', job.id)
  }
  return reply(200, { claimed: (jobs ?? []).length })
})
