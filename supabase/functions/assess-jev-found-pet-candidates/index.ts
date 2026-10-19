import { createClient } from '@supabase/supabase-js'
import {
  JEV_MODEL,
  JEV_RUBRIC_VERSION,
  assessFoundPetCandidate,
} from '../_shared/jev-assessment.js'

const pipelineVersion = 'found-pet-jev-shadow-v1'

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method !== 'POST')
    return reply(405, { error: 'Method not allowed.' })
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!url || !serviceKey || token !== serviceKey)
    return reply(401, { error: 'Service role required.' })
  const { reportId, queueId } = (await request.json().catch(() => ({}))) as {
    reportId?: string
    queueId?: string
  }
  if (!reportId || !queueId)
    return reply(400, { error: 'A report and shadow queue job are required.' })

  const admin = createClient(url, serviceKey)
  const { data: job } = await admin
    .from('jev_found_pet_assessment_queue')
    .select('id,report_version,requested_by')
    .eq('id', queueId)
    .eq('found_pet_report_id', reportId)
    .eq('status', 'running')
    .maybeSingle()
  if (!job) return reply(409, { error: 'Jev assessment job is not claimable.' })

  const [{ data: report }, { data: policy }] = await Promise.all([
    admin
      .from('found_pet_reports')
      .select('species,breed,colour,details,found_at,ai_scoring_version')
      .eq('id', reportId)
      .eq('moderation_status', 'approved')
      .eq('lifecycle_status', 'active')
      .maybeSingle(),
    admin.from('found_pet_matching_policy').select('version').eq('id', true).single(),
  ])
  if (!report || !policy || report.ai_scoring_version !== job.report_version)
    return reply(200, { outcome: 'skipped_stale_or_unavailable' })

  const baseRun = {
    found_pet_report_id: reportId,
    queue_id: queueId,
    report_version: job.report_version,
    model: JEV_MODEL,
    rubric_version: JEV_RUBRIC_VERSION,
    policy_version: policy.version,
    pipeline_version: pipelineVersion,
  }
  if (Deno.env.get('TYPESAFE_JEV_SHADOW_MODE') !== 'enabled') {
    await admin.from('jev_found_pet_assessment_runs').insert({
      ...baseRun,
      candidate_count: 0,
      status: 'skipped',
      outcome: 'shadow_disabled',
      completed_at: new Date().toISOString(),
    })
    return reply(200, { outcome: 'skipped_shadow_disabled' })
  }

  const apiKey = Deno.env.get('TYPESAFE_JEV_API_KEY')
  if (!apiKey) return reply(503, { error: 'Jev is not configured.' })
  const { data: previous } = await admin
    .from('jev_found_pet_assessment_runs')
    .select('id')
    .eq('found_pet_report_id', reportId)
    .eq('report_version', job.report_version)
    .eq('status', 'completed')
    .maybeSingle()
  if (previous) return reply(200, { outcome: 'skipped_idempotent' })

  const { data: candidates, error: candidatesError } = await admin.rpc(
    'found_pet_case_candidates',
    { target_report_id: reportId },
  )
  if (candidatesError) return reply(502, { error: 'Could not load candidates.' })
  const shortlist = candidates ?? []
  const { data: run, error: runError } = await admin
    .from('jev_found_pet_assessment_runs')
    .insert({ ...baseRun, candidate_count: shortlist.length, status: 'running', outcome: 'running' })
    .select('id')
    .single()
  if (runError || !run) return reply(502, { error: 'Could not record Jev assessment.' })

  const startedAt = Date.now()
  try {
    const { data: details } = shortlist.length
      ? await admin
          .from('missing_cases')
          .select('id,last_seen_at,last_seen_description,pet:pets(species,breed,colour,description)')
          .in('id', shortlist.map((candidate) => candidate.case_id))
      : { data: [] }
    const detailsByCase = new Map((details ?? []).map((item) => [item.id, item]))
    const rows = []
    let inputTokens = 0
    let outputTokens = 0
    for (const candidate of shortlist) {
      const detail = detailsByCase.get(candidate.case_id)
      const pet = Array.isArray(detail?.pet) ? detail.pet[0] : detail?.pet
      const elapsedHours = detail?.last_seen_at
        ? (new Date(report.found_at).getTime() - new Date(detail.last_seen_at).getTime()) / 3_600_000
        : null
      const result = await assessFoundPetCandidate({
        apiKey,
        input: {
          found: report,
          candidate: {
            species: pet?.species ?? report.species,
            breed: pet?.breed ?? candidate.breed,
            colour: pet?.colour ?? candidate.colour,
            details: `${pet?.description ?? ''} ${detail?.last_seen_description ?? ''}`,
          },
          distanceKm: candidate.distance_km,
          elapsedHours,
        },
      })
      inputTokens += result.usage.inputTokens
      outputTokens += result.usage.outputTokens
      rows.push({
        run_id: run.id,
        found_pet_report_id: reportId,
        case_id: candidate.case_id,
        route: result.route,
        probability: result.probability,
        confidence: result.confidence,
        dimensions: result.dimensions,
      })
    }
    if (rows.length) {
      const { error } = await admin.from('jev_found_pet_candidate_assessments').insert(rows)
      if (error) throw new Error('Could not save Jev assessments.')
    }
    await admin.from('jev_found_pet_assessment_runs').update({
      status: 'completed', outcome: 'shadow_completed', completed_at: new Date().toISOString(),
      latency_ms: Date.now() - startedAt, input_tokens: inputTokens, output_tokens: outputTokens,
      estimated_cost_microusd: inputTokens * 0.042,
    }).eq('id', run.id)
    return reply(200, { outcome: 'completed' })
  } catch (cause) {
    const retryable = Boolean((cause as { retryable?: boolean }).retryable)
    const message = cause instanceof Error ? cause.message.slice(0, 240) : 'Jev assessment failed.'
    await admin.from('jev_found_pet_assessment_runs').update({
      status: 'failed', outcome: 'staff_review_required', failure_reason: message,
      completed_at: new Date().toISOString(), latency_ms: Date.now() - startedAt,
    }).eq('id', run.id)
    return reply(503, { error: message, retryable })
  }
})
