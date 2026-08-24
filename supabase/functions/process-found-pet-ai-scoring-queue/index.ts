import { createClient } from '@supabase/supabase-js'

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

// Invoke from a scheduled job and after enqueueing. Claiming is transactional,
// so concurrent invocations neither duplicate work nor bypass budgets.
Deno.serve(async (request) => {
  if (request.method !== 'POST')
    return reply(405, { error: 'Method not allowed.' })
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!url || !serviceKey || token !== serviceKey)
    return reply(401, { error: 'Service role required.' })
  const admin = createClient(url, serviceKey)
  const { data: jobs, error } = await admin.rpc(
    'claim_found_pet_ai_scoring_jobs',
    { max_jobs: 1 },
  )
  if (error) return reply(500, { error: 'Could not claim AI scoring work.' })
  let completed = 0
  for (const job of jobs ?? []) {
    try {
      const result = await fetch(
        `${url}/functions/v1/score-found-pet-candidates`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
            'content-type': 'application/json',
            'x-petseen-internal': serviceKey,
          },
          body: JSON.stringify({
            reportId: job.found_pet_report_id,
            queueId: job.id,
          }),
        },
      )
      const payload = (await result.json().catch(() => ({}))) as {
        outcome?: string
        error?: string
      }
      if (!result.ok)
        throw new Error(payload.error ?? `Scorer returned ${result.status}`)
      await admin
        .from('ai_found_pet_scoring_queue')
        .update({
          status: payload.outcome?.startsWith('skipped')
            ? 'skipped'
            : 'completed',
          completed_at: new Date().toISOString(),
          leased_until: null,
          last_error: null,
        })
        .eq('id', job.id)
      completed++
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message.slice(0, 240)
          : 'Analysis failed.'
      const retry = job.attempts < 3
      await admin
        .from('ai_found_pet_scoring_queue')
        .update(
          retry
            ? {
                status: 'pending',
                available_at: new Date(
                  Date.now() + job.attempts * 60_000,
                ).toISOString(),
                leased_until: null,
                last_error: message,
              }
            : {
                status: 'failed',
                completed_at: new Date().toISOString(),
                leased_until: null,
                last_error: message,
              },
        )
        .eq('id', job.id)
    }
  }
  return reply(200, { claimed: (jobs ?? []).length, completed })
})
