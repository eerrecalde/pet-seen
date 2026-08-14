import { createClient } from '@supabase/supabase-js'

const model = 'gpt-4.1-mini'
const allowedOrigins = new Set(['https://petseen-staging.pages.dev', 'http://127.0.0.1:5173', 'http://localhost:5173'])
function corsHeaders(request: Request) { const origin = request.headers.get('origin'); const local = origin ? /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) : false; return { ...(origin && (allowedOrigins.has(origin) || local) ? { 'access-control-allow-origin': origin, vary: 'origin' } : {}), 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST, OPTIONS' } }
function reply(request: Request, status: number, body: Record<string, unknown>) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(request), 'content-type': 'application/json' } }) }
type Candidate = { case_id: string, pet_name: string, breed: string | null, colour: string | null, last_seen_at: string | null, distance_km: number, match_score: number, match_reasons: string[] }
type Result = { case_id: string, similarity_score: number, confidence: 'low' | 'medium' | 'high', explanation: string }
type ResponsesPayload = { output_text?: string, output?: Array<{ content?: Array<{ type?: string, text?: string }> }> }
function outputText(payload: ResponsesPayload) { return payload.output_text ?? payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === 'output_text')?.text ?? '' }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) })
  if (request.method !== 'POST') return reply(request, 405, { error: 'Method not allowed.' })
  const url = Deno.env.get('SUPABASE_URL'), serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), apiKey = Deno.env.get('OPENAI_API_KEY'), token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!url || !serviceKey || !token) return reply(request, 401, { error: 'Sign in is required.' })
  if (!apiKey) return reply(request, 503, { error: 'AI candidate scoring is not configured.' })
  const { sightingId } = await request.json().catch(() => ({})) as { sightingId?: string }
  if (!sightingId) return reply(request, 400, { error: 'An unlinked sighting is required.' })
  const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { authorization: `Bearer ${token}` } } })
  const { data: staff } = await user.rpc('is_authorized_staff')
  if (staff !== true) return reply(request, 403, { error: 'Only Pet Seen staff can run AI candidate scoring.' })
  const { data: candidateData, error: candidateError } = await user.rpc('unlinked_sighting_case_candidates', { target_sighting_id: sightingId })
  if (candidateError) return reply(request, 400, { error: candidateError.message })
  const candidates = (candidateData ?? []) as Candidate[]
  if (!candidates.length) return reply(request, 200, { scores: [] })
  const admin = createClient(url, serviceKey)
  const { data: actor } = await admin.auth.getUser(token)
  const { data: sighting } = await admin.from('sightings').select('details,location_description').eq('id', sightingId).is('case_id', null).maybeSingle()
  if (!actor.user || !sighting) return reply(request, 404, { error: 'This unlinked sighting is not available for scoring.' })
  const { data: run, error: runError } = await admin.from('ai_unlinked_sighting_match_runs').insert({ sighting_id: sightingId, requested_by: actor.user.id, model, candidate_count: candidates.length }).select('id').single()
  if (runError || !run) return reply(request, 502, { error: 'Could not record the AI analysis request.' })
  try {
    const shortlist = candidates.map((candidate) => ({ case_id: candidate.case_id, pet: { name: candidate.pet_name, breed: candidate.breed, colour: candidate.colour }, deterministic_score: candidate.match_score, deterministic_reasons: candidate.match_reasons, distance_km: candidate.distance_km, last_seen_at: candidate.last_seen_at }))
    const prompt = `Assess whether this unlinked sighting description could describe each candidate pet. This is private staff decision support, never identity verification. Be conservative: generic or uncertain evidence must receive low confidence. Do not infer identity from distance alone. Return only JSON matching the schema.\n\nSighting: ${JSON.stringify({ details: sighting.details, location_description: sighting.location_description })}\n\nCandidates: ${JSON.stringify(shortlist)}`
    const itemSchema = { type: 'object', additionalProperties: false, required: ['case_id', 'similarity_score', 'confidence', 'explanation'], properties: { case_id: { type: 'string' }, similarity_score: { type: 'integer', minimum: 0, maximum: 100 }, confidence: { type: 'string', enum: ['low', 'medium', 'high'] }, explanation: { type: 'string', minLength: 1, maxLength: 800 } } }
    const schema = { type: 'object', additionalProperties: false, required: ['scores'], properties: { scores: { type: 'array', minItems: candidates.length, maxItems: candidates.length, items: itemSchema } } }
    const openai = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ model, input: prompt, text: { format: { type: 'json_schema', name: 'sighting_candidate_scores', strict: true, schema } } }) })
    if (!openai.ok) throw new Error(`OpenAI request failed (${openai.status})`)
    const parsed = JSON.parse(outputText(await openai.json() as ResponsesPayload) || '{}') as { scores?: Result[] }
    if (!parsed.scores || parsed.scores.length !== candidates.length || new Set(parsed.scores.map((score) => score.case_id)).size !== candidates.length || parsed.scores.some((score) => !candidates.some((candidate) => candidate.case_id === score.case_id))) throw new Error('AI response did not cover the deterministic shortlist')
    const rows = parsed.scores.map((score) => { const candidate = candidates.find((item) => item.case_id === score.case_id)!; const ai = Math.round(Math.max(0, Math.min(100, score.similarity_score))); const combined = Math.round(candidate.match_score * .65 + ai * .35); return { run_id: run.id, sighting_id: sightingId, case_id: score.case_id, deterministic_score: candidate.match_score, ai_similarity_score: ai, combined_score: combined, confidence: score.confidence, explanation: score.explanation.trim().slice(0, 800), priority_review: candidate.match_score >= 75 && ai >= 85 && score.confidence === 'high' && combined >= 85 } })
    const { error } = await admin.from('ai_unlinked_sighting_match_scores').insert(rows)
    if (error) throw new Error('Could not save AI scores')
    return reply(request, 200, { scores: rows })
  } catch { return reply(request, 502, { error: 'AI candidate analysis did not complete. No match was created.' }) }
})
