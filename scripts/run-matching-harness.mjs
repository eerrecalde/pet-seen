import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { decideFoundPetMatches } from '../supabase/functions/_shared/found-pet-matching-decision.js'

const root = resolve(new URL('..', import.meta.url).pathname)
const fixturePath = resolve(root, 'scripts/matching-harness-scenarios.v1.json')
const outputPath = resolve(root, 'tmp/matching-harness-results.json')

function option(name) {
  const prefix = `--${name}=`
  return process.argv
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length)
}

const privateFixtureKeys = new Set([
  'address',
  'email',
  'exactLocation',
  'latitude',
  'longitude',
  'objectPath',
  'phone',
  'storagePath',
])

export function assertPublicSafeFixture(value) {
  if (Array.isArray(value)) {
    value.forEach(assertPublicSafeFixture)
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, nested] of Object.entries(value)) {
    if (privateFixtureKeys.has(key))
      throw new Error(`Fixture field ${key} is not public-safe.`)
    assertPublicSafeFixture(nested)
  }
}

function selectScenarios(scenarios, scenarioFilter) {
  if (!scenarioFilter) return scenarios
  const selectedIds = new Set(scenarioFilter.split(',').filter(Boolean))
  const selected = scenarios.filter((scenario) => selectedIds.has(scenario.id))
  if (selected.length !== selectedIds.size)
    throw new Error('One or more requested scenarios do not exist.')
  return selected
}

function preflight(scenarios) {
  const candidates = scenarios.flatMap((scenario) => scenario.candidates)
  const eligible = candidates.filter((candidate) => candidate.eligible)
  const vision = eligible.filter(
    (candidate) =>
      candidate.hasPhoto && candidate.jev?.route !== 'incompatible',
  )
  return {
    scenarios: scenarios.length,
    jevCalls: eligible.length,
    openaiCalls: vision.length,
    imagePairs: vision.length,
  }
}

function fixtureAdapters() {
  return {
    jev: {
      assess: ({ candidate }) => {
        if (candidate.jev?.error) throw new Error(candidate.jev.error)
        return candidate.jev
      },
    },
    openai: {
      compare: ({ candidate }) => {
        if (candidate.vision?.error) throw new Error(candidate.vision.error)
        return candidate.vision
      },
    },
  }
}

function resultFor(scenario, decision) {
  const routes = Object.fromEntries(
    decision.decisions.map((item) => [item.caseId, item.route]),
  )
  const eligibility = Object.fromEntries(
    scenario.candidates.map((item) => [item.caseId, item.eligible]),
  )
  const visionCaseIds = decision.decisions
    .filter((item) => item.providers.includes('openai'))
    .map((item) => item.caseId)
  const safeEffects = decision.decisions.every(
    (item) => !item.effects.link && !item.effects.notify,
  )
  const recommendedCaseId = decision.recommendation?.caseId ?? null
  const pass =
    JSON.stringify(eligibility) ===
      JSON.stringify(scenario.expected.eligibility) &&
    JSON.stringify(routes) === JSON.stringify(scenario.expected.routes) &&
    JSON.stringify(visionCaseIds) ===
      JSON.stringify(scenario.expected.visionCaseIds) &&
    JSON.stringify(decision.calls) ===
      JSON.stringify(scenario.expected.calls) &&
    recommendedCaseId === (scenario.expected.recommendedCaseId ?? null) &&
    safeEffects
  return {
    case: scenario.id,
    providers: scenario.providerMode,
    expectedEligibility: scenario.expected.eligibility,
    actualEligibility: eligibility,
    expected: scenario.expected.routes,
    actual: routes,
    expectedRecommendation: scenario.expected.recommendedCaseId ?? null,
    actualRecommendation: recommendedCaseId,
    pass,
    latencyMs: 0,
    tokenUsage: 0,
    estimatedCostCents: 0,
    sideEffects: safeEffects ? 'none' : 'unexpected',
  }
}

export async function runFixtureHarness({ scenarioFilter } = {}) {
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
  assertPublicSafeFixture(fixture)
  const scenarios = selectScenarios(fixture.scenarios, scenarioFilter)
  const results = []
  for (const scenario of scenarios) {
    const decision = await decideFoundPetMatches({
      report: scenario.report,
      candidates: scenario.candidates,
      adapters: fixtureAdapters(),
    })
    results.push(resultFor(scenario, decision))
  }
  await mkdir(resolve(root, 'tmp'), { recursive: true })
  await writeFile(
    outputPath,
    `${JSON.stringify({ version: fixture.version, results }, null, 2)}\n`,
  )
  return { results, outputPath, preflight: preflight(scenarios) }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const requestedProvider =
    option('provider') ?? process.env.MATCHING_PROVIDER ?? 'fixture'
  const scenarioFilter = option('scenario')
  const maxRuns = Number(option('max-runs') ?? '10')
  if (!Number.isInteger(maxRuns) || maxRuns < 1)
    throw new Error('--max-runs must be a positive integer.')
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
  assertPublicSafeFixture(fixture)
  const selected = selectScenarios(fixture.scenarios, scenarioFilter)
  const planned = preflight(selected)
  if (
    requestedProvider !== 'fixture' &&
    planned.jevCalls + planned.openaiCalls > maxRuns
  )
    throw new Error(
      `Preflight exceeds the maximum of ${maxRuns} provider calls.`,
    )
  if (
    requestedProvider !== 'fixture' &&
    process.env.MATCHING_PAID_RUN !== '1'
  ) {
    throw new Error('Live evaluation requires MATCHING_PAID_RUN=1.')
  }
  if (requestedProvider !== 'fixture') {
    console.table([{ provider: requestedProvider, maxRuns, ...planned }])
    throw new Error(
      `Live ${requestedProvider} evaluation is unavailable until its pinned provider adapter is supplied by PS-430/PS-431. No provider call was made.`,
    )
  }
  const { results, outputPath: saved } = await runFixtureHarness({
    scenarioFilter,
  })
  console.table(results)
  console.log(`Redacted results saved to ${saved}`)
  if (results.some((result) => !result.pass)) process.exitCode = 1
}
