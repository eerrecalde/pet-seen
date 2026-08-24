import { createClient } from '@supabase/supabase-js'

const model = 'gpt-4.1-mini'
const maxImageBytes = 1_500_000
const maxImageDimension = 1600
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
      'authorization, x-client-info, apikey, content-type, x-petseen-internal',
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
    headers: { ...corsHeaders(request), 'content-type': 'application/json' },
  })
}
function base64(bytes: Uint8Array) {
  let binary = ''
  for (let start = 0; start < bytes.length; start += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000))
  return btoa(binary)
}
function jpegDimensions(bytes: Uint8Array) {
  for (let index = 2; index + 9 < bytes.length;) {
    if (bytes[index] !== 0xff) return null
    const marker = bytes[index + 1]
    const length = (bytes[index + 2] << 8) | bytes[index + 3]
    if (length < 2) return null
    if (marker >= 0xc0 && marker <= 0xc3)
      return {
        height: (bytes[index + 5] << 8) | bytes[index + 6],
        width: (bytes[index + 7] << 8) | bytes[index + 8],
      }
    index += length + 2
  }
  return null
}
async function boundedJpegDataUrl(blob: Blob) {
  if (blob.size > maxImageBytes) return undefined
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const dimensions = jpegDimensions(bytes)
  if (
    !dimensions ||
    dimensions.width > maxImageDimension ||
    dimensions.height > maxImageDimension
  )
    return undefined
  return `data:image/jpeg;base64,${base64(bytes)}`
}

type Candidate = {
  case_id: string
  pet_name: string
  breed: string | null
  colour: string | null
  last_seen_at: string | null
  distance_km: number
  match_score: number
  match_reasons: string[]
}
type CandidateCase = { id: string; pet_id: string }
type CandidatePhoto = { pet_id: string; display_object_path: string | null }
type AiResult = {
  case_id: string
  similarity_score: number
  confidence: 'low' | 'medium' | 'high'
  explanation: string
}
type ResponsesPayload = {
  output_text?: string
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>
}
function outputText(payload: ResponsesPayload) {
  return (
    payload.output_text ??
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .find((item) => item.type === 'output_text')?.text ??
    ''
  )
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: corsHeaders(request) })
  if (request.method !== 'POST')
    return response(request, 405, { error: 'Method not allowed.' })
  const url = Deno.env.get('SUPABASE_URL'),
    serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    apiKey = Deno.env.get('OPENAI_API_KEY'),
    token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!url || !serviceKey || !token)
    return response(request, 401, { error: 'Sign in is required.' })
  if (!apiKey)
    return response(request, 503, {
      error: 'AI candidate scoring is not configured.',
    })
  const { reportId, queueId } = (await request.json().catch(() => ({}))) as {
    reportId?: string
    queueId?: string
  }
  if (!reportId)
    return response(request, 400, { error: 'A found-pet report is required.' })
  const serviceCall = request.headers.get('x-petseen-internal') === serviceKey
  const admin = createClient(url, serviceKey)
  const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { authorization: `Bearer ${token}` } },
  })
  const { data: staff } = serviceCall
    ? { data: false }
    : await user.rpc('is_authorized_staff')
  if (!serviceCall && staff !== true)
    return response(request, 403, {
      error: 'Only Pet Seen staff can run AI candidate scoring.',
    })
  // Staff requests only enqueue work. Provider calls are accepted exclusively
  // from the queue worker, so a browser cannot turn retries into provider spend.
  if (!serviceCall) {
    const { data: actor } = await admin.auth.getUser(token)
    const { data: job, error } = await admin.rpc(
      'enqueue_found_pet_ai_scoring',
      {
        target_report_id: reportId,
        actor_id: actor.user?.id ?? null,
      },
    )
    if (error || !job)
      return response(request, 400, {
        error: error?.message ?? 'Could not queue AI scoring.',
      })
    return response(request, 202, { status: 'queued', jobId: job })
  }
  if (!queueId)
    return response(request, 400, { error: 'A queue job is required.' })
  const { data: job } = await admin
    .from('ai_found_pet_scoring_queue')
    .select('id,report_version,requested_by,status')
    .eq('id', queueId)
    .eq('found_pet_report_id', reportId)
    .eq('status', 'running')
    .maybeSingle()
  if (!job)
    return response(request, 409, { error: 'AI scoring job is not claimable.' })
  const { data: candidates, error: candidatesError } = await (
    serviceCall ? admin : user
  ).rpc('found_pet_case_candidates', { target_report_id: reportId })
  if (candidatesError)
    return response(request, 400, { error: candidatesError.message })
  const shortlist = ((candidates ?? []) as Candidate[])
    .filter((candidate) => candidate.match_score >= 70)
    .slice(0, 3)
  if (!shortlist.length)
    return response(request, 200, { scores: [], outcome: 'skipped_shortlist' })
  const { data: report } = await admin
    .from('found_pet_reports')
    .select(
      'species,breed,colour,details,ai_scoring_version,photo:found_pet_photos(display_object_path)',
    )
    .eq('id', reportId)
    .eq('moderation_status', 'approved')
    .eq('lifecycle_status', 'active')
    .maybeSingle()
  if (!report)
    return response(request, 404, {
      error: 'This active approved report is not available for scoring.',
    })
  if (report.ai_scoring_version !== job.report_version)
    return response(request, 200, {
      scores: [],
      outcome: 'skipped_stale_version',
    })
  const { data: previous } = await admin
    .from('ai_found_pet_match_runs')
    .select('id')
    .eq('found_pet_report_id', reportId)
    .eq('report_version', job.report_version)
    .eq('status', 'completed')
    .maybeSingle()
  if (previous)
    return response(request, 200, { scores: [], outcome: 'skipped_idempotent' })
  const startedAt = Date.now()
  const { data: run, error: runError } = await admin
    .from('ai_found_pet_match_runs')
    .insert({
      found_pet_report_id: reportId,
      requested_by: job.requested_by,
      model,
      candidate_count: shortlist.length,
      report_version: job.report_version,
      queue_id: queueId,
      outcome: 'failed',
      estimated_cost_cents: 3,
      status: 'failed',
      failure_reason: 'Analysis did not complete.',
      completed_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (runError || !run)
    return response(request, 502, {
      error: 'Could not record the AI analysis request.',
    })
  try {
    const photo = Array.isArray(report.photo) ? report.photo[0] : report.photo
    let imageDataUrl: string | undefined
    if (photo?.display_object_path) {
      const { data, error } = await admin.storage
        .from('found-pet-photos')
        .download(photo.display_object_path)
      if (!error && data) imageDataUrl = await boundedJpegDataUrl(data)
    }
    const { data: candidateCases } = await admin
      .from('missing_cases')
      .select('id,pet_id')
      .in(
        'id',
        shortlist.map((candidate) => candidate.case_id),
      )
    const candidateCaseRecords = (candidateCases ?? []) as CandidateCase[]
    const { data: candidatePhotos } = candidateCaseRecords.length
      ? await admin
          .from('pet_photos')
          .select('pet_id,display_object_path')
          .in(
            'pet_id',
            candidateCaseRecords.map((candidate) => candidate.pet_id),
          )
          .not('display_object_path', 'is', null)
      : { data: [] as CandidatePhoto[] }
    const photoPathByPetId = new Map(
      (candidatePhotos ?? ([] as CandidatePhoto[])).map((candidate) => [
        candidate.pet_id,
        candidate.display_object_path,
      ]),
    )
    const petIdByCaseId = new Map(
      candidateCaseRecords.map((candidate) => [candidate.id, candidate.pet_id]),
    )
    const candidateImageDataUrls = new Map<string, string>()
    await Promise.all(
      shortlist.slice(0, 3).map(async (candidate) => {
        const path = photoPathByPetId.get(
          petIdByCaseId.get(candidate.case_id) ?? '',
        )
        if (!path) return
        const { data, error } = await admin.storage
          .from('pet-photos')
          .download(path)
        if (!error && data) {
          const dataUrl = await boundedJpegDataUrl(data)
          if (dataUrl) candidateImageDataUrls.set(candidate.case_id, dataUrl)
        }
      }),
    )
    const candidateText = shortlist.map((candidate) => ({
      case_id: candidate.case_id,
      pet: {
        name: candidate.pet_name,
        breed: candidate.breed,
        colour: candidate.colour,
      },
      deterministic_score: candidate.match_score,
      deterministic_reasons: candidate.match_reasons,
      distance_km: candidate.distance_km,
      last_seen_at: candidate.last_seen_at,
    }))
    const content: Array<Record<string, unknown>> = [
      {
        type: 'input_text',
        text: `Assess whether this found pet could be the same animal as each candidate. This is a private staff aid, not identity verification. Be conservative: uncertain, generic, or conflicting evidence must receive low confidence. Do not infer a match from location alone. Compare the found-pet photo with each labelled candidate photo when both are available. Return only JSON matching the schema.\n\nFound report: ${JSON.stringify({ species: report.species, breed: report.breed, colour: report.colour, details: report.details })}\n\nCandidates: ${JSON.stringify(candidateText)}`,
      },
    ]
    if (imageDataUrl) {
      content.push({ type: 'input_text', text: 'Found-pet photo:' })
      content.push({
        type: 'input_image',
        image_url: imageDataUrl,
        detail: 'low',
      })
    }
    for (const candidate of shortlist) {
      const candidateImageDataUrl = candidateImageDataUrls.get(
        candidate.case_id,
      )
      if (candidateImageDataUrl) {
        content.push({
          type: 'input_text',
          text: `Candidate photo for case_id ${candidate.case_id}:`,
        })
        content.push({
          type: 'input_image',
          image_url: candidateImageDataUrl,
          detail: 'low',
        })
      }
    }
    const itemSchema = {
      type: 'object',
      additionalProperties: false,
      required: ['case_id', 'similarity_score', 'confidence', 'explanation'],
      properties: {
        case_id: { type: 'string' },
        similarity_score: { type: 'integer', minimum: 0, maximum: 100 },
        confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        explanation: { type: 'string', minLength: 1, maxLength: 800 },
      },
    }
    const schema = {
      type: 'object',
      additionalProperties: false,
      required: ['scores'],
      properties: {
        scores: {
          type: 'array',
          minItems: shortlist.length,
          maxItems: shortlist.length,
          items: itemSchema,
        },
      },
    }
    const aiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [{ role: 'user', content }],
        text: {
          format: {
            type: 'json_schema',
            name: 'candidate_scores',
            strict: true,
            schema,
          },
        },
      }),
    })
    if (!aiResponse.ok) {
      const detail = (await aiResponse.text())
        .replace(/\s+/g, ' ')
        .slice(0, 160)
      throw new Error(
        `OpenAI request failed (${aiResponse.status}): ${detail || 'no detail returned'}`,
      )
    }
    const payload = (await aiResponse.json()) as ResponsesPayload & {
      usage?: { input_tokens?: number; output_tokens?: number }
    }
    const parsed = JSON.parse(outputText(payload) || '{}') as {
      scores?: AiResult[]
    }
    if (
      !parsed.scores ||
      parsed.scores.length !== shortlist.length ||
      new Set(parsed.scores.map((score) => score.case_id)).size !==
        shortlist.length ||
      parsed.scores.some(
        (score) =>
          !shortlist.some((candidate) => candidate.case_id === score.case_id),
      )
    )
      throw new Error('AI response did not cover the deterministic shortlist')
    const rows = parsed.scores.map((score) => {
      const candidate = shortlist.find(
        (item) => item.case_id === score.case_id,
      )!
      const aiScore = Math.round(
        Math.max(0, Math.min(100, score.similarity_score)),
      )
      const combined = Math.round(candidate.match_score * 0.65 + aiScore * 0.35)
      return {
        run_id: run.id,
        found_pet_report_id: reportId,
        case_id: score.case_id,
        deterministic_score: candidate.match_score,
        ai_similarity_score: aiScore,
        combined_score: combined,
        confidence: score.confidence,
        explanation: score.explanation.trim().slice(0, 800),
        priority_review:
          candidate.match_score >= 75 &&
          aiScore >= 85 &&
          score.confidence === 'high' &&
          combined >= 85,
      }
    })
    const { error: scoreError } = await admin
      .from('ai_found_pet_match_scores')
      .insert(rows)
    if (scoreError) throw new Error('Could not save AI scores')
    const { error: autoLinkError } = await admin.rpc(
      'create_provisional_found_pet_match',
      { target_report_id: reportId },
    )
    if (autoLinkError)
      throw new Error('Could not create the automatic owner-review link')
    await admin
      .from('ai_found_pet_match_runs')
      .update({
        status: 'completed',
        outcome: 'completed',
        failure_reason: null,
        completed_at: new Date().toISOString(),
        latency_ms: Date.now() - startedAt,
        input_tokens: payload.usage?.input_tokens ?? null,
        output_tokens: payload.usage?.output_tokens ?? null,
      })
      .eq('id', run.id)
    return response(request, 200, { scores: rows })
  } catch (error) {
    const failureReason =
      error instanceof Error ? error.message.slice(0, 240) : 'Analysis failed.'
    await admin
      .from('ai_found_pet_match_runs')
      .update({
        failure_reason: failureReason,
        outcome: 'failed',
        completed_at: new Date().toISOString(),
        latency_ms: Date.now() - startedAt,
      })
      .eq('id', run.id)
    return response(request, 502, {
      error: 'AI candidate analysis did not complete. No match was created.',
    })
  }
})
