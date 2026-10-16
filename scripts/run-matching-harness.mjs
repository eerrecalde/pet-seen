import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { decideFoundPetMatches } from '../supabase/functions/_shared/found-pet-matching-decision.js'

const root = resolve(new URL('..', import.meta.url).pathname)
const fixturePath = resolve(root, 'scripts/matching-harness-scenarios.v1.json')
const outputPath = resolve(root, 'tmp/matching-harness-results.json')

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

export async function runFixtureHarness() {
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
  const results = []
  for (const scenario of fixture.scenarios) {
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
  return { results, outputPath }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const requestedProvider = process.env.MATCHING_PROVIDER ?? 'fixture'
  if (
    requestedProvider !== 'fixture' &&
    process.env.MATCHING_PAID_RUN !== '1'
  ) {
    throw new Error('Live evaluation requires MATCHING_PAID_RUN=1.')
  }
  if (requestedProvider !== 'fixture') {
    throw new Error(
      `Live ${requestedProvider} evaluation is unavailable until its pinned provider adapter is supplied by PS-430/PS-431. No provider call was made.`,
    )
  }
  const { results, outputPath: saved } = await runFixtureHarness()
  console.table(results)
  console.log(`Redacted results saved to ${saved}`)
  if (results.some((result) => !result.pass)) process.exitCode = 1
}
