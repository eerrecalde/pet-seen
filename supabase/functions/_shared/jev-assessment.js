// PS-430: this boundary is deliberately text-only.  Callers provide derived
// distance/time values and the selected pet attributes; it never accepts IDs,
// coordinates, contacts, storage paths, or image data.
export const JEV_ENDPOINT = 'https://api.typesafe.ai/v1/systemone'
export const JEV_MODEL = 'jev-1.13.0'
export const JEV_RUBRIC_VERSION = 'found-pet-text-v1'

const dimensions = [
  ['breed', 'Are the reported breed or type descriptions compatible?'],
  ['markings', 'Are the colour and markings descriptions compatible?'],
  [
    'report_details',
    'Are the non-location report details compatible without inferring identity?',
  ],
]
const choices = {
  compatible: 'The available text can describe the same pet.',
  incompatible: 'The available text describes conflicting pet attributes.',
  uncertain: 'The text is incomplete, vague, or insufficient to decide.',
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1500)
}

function petAttributes(pet) {
  return {
    species: cleanText(pet.species),
    breed: cleanText(pet.breed) || null,
    colour: cleanText(pet.colour) || null,
    details: cleanText(pet.details),
  }
}

export function buildJevAssessmentRequest({
  found,
  candidate,
  distanceKm,
  elapsedHours,
}) {
  const state = {
    found: petAttributes(found),
    candidate: petAttributes(candidate),
    distance_km: Math.round(Number(distanceKm) * 10) / 10,
    elapsed_hours:
      elapsedHours === null || elapsedHours === undefined
        ? null
        : Math.round(Number(elapsedHours)),
  }
  if (!Number.isFinite(state.distance_km) || state.distance_km < 0)
    throw new Error('Jev assessment requires a non-negative derived distance.')
  if (state.elapsed_hours !== null && !Number.isFinite(state.elapsed_hours))
    throw new Error('Jev assessment requires a derived elapsed time.')

  return {
    model: JEV_MODEL,
    rubricVersion: JEV_RUBRIC_VERSION,
    state,
    questions: Object.fromEntries(
      dimensions.map(([key, instructions]) => [
        key,
        { type: 'choice', instructions, criteria: choices },
      ]),
    ),
  }
}

function providerError(status) {
  return Object.assign(new Error(`Jev request failed (${status}).`), {
    status,
    retryable: status === 429 || status === 529 || status >= 500,
  })
}

function confidenceFor(answers) {
  const rank = { low: 0, medium: 1, high: 2 }
  return answers.reduce(
    (lowest, answer) =>
      rank[answer.confidence] < rank[lowest] ? answer.confidence : lowest,
    'high',
  )
}

function routeFor(answers) {
  if (answers.every((answer) => answer.choice === 'incompatible'))
    return 'incompatible'
  if (answers.every((answer) => answer.choice === 'uncertain'))
    return 'uncertain'
  return 'possible'
}

function parseAnswer(key, answer) {
  if (
    !answer ||
    !Object.hasOwn(choices, answer.choice) ||
    !['low', 'medium', 'high'].includes(answer.confidence) ||
    !answer.probabilities ||
    !Object.entries(choices).every(
      ([choice]) =>
        typeof answer.probabilities[choice] === 'number' &&
        answer.probabilities[choice] >= 0 &&
        answer.probabilities[choice] <= 1,
    )
  )
    throw new Error(`Jev returned an invalid ${key} assessment.`)
  return {
    dimension: key,
    choice: answer.choice,
    probability: answer.probabilities[answer.choice],
    confidence: answer.confidence,
    probabilities: answer.probabilities,
  }
}

export async function assessFoundPetCandidate({
  apiKey,
  input,
  fetcher = fetch,
}) {
  if (!apiKey) throw new Error('Jev is not configured.')
  const { rubricVersion, ...request } = buildJevAssessmentRequest(input)
  const response = await fetcher(JEV_ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw providerError(response.status)
  const payload = await response.json()
  const parsed = dimensions.map(([key]) =>
    parseAnswer(key, payload.answers?.[key]),
  )
  const probability = Math.min(
    ...parsed.map((answer) => answer.probabilities.compatible),
  )
  return {
    model: payload.model === JEV_MODEL ? payload.model : JEV_MODEL,
    rubricVersion,
    route: routeFor(parsed),
    probability,
    confidence: confidenceFor(parsed),
    dimensions: parsed,
    usage: {
      inputTokens: Number(payload.usage?.input_tokens) || 0,
      outputTokens: Number(payload.usage?.output_tokens) || 0,
    },
  }
}
