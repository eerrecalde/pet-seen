import { describe, expect, it } from 'vitest'
import {
  assertPublicSafeFixture,
  runFixtureHarness,
} from '../../scripts/run-matching-harness.mjs'

describe('PS-432 fixture matching harness', () => {
  it('replays every synthetic scenario without provider calls or side effects', async () => {
    const { results } = await runFixtureHarness()
    expect(results).toHaveLength(9)
    expect(results.every((result) => result.pass)).toBe(true)
    expect(
      results.find((result) => result.case === 'high-confidence-incompatible')
        ?.actual,
    ).toEqual({ 'case-conflict': 'stopped_incompatible' })
    expect(
      results.find(
        (result) => result.case === 'negative-vision-no-side-effects',
      )?.sideEffects,
    ).toBe('none')
    expect(
      results.find(
        (result) => result.case === 'malformed-provider-output-safe-review',
      )?.actual,
    ).toEqual({ 'case-invalid-provider-output': 'staff_review' })
    expect(
      results.find(
        (result) => result.case === 'single-top-review-recommendation',
      )?.actualRecommendation,
    ).toBe('case-best')
  })

  it('can isolate one named synthetic scenario', async () => {
    const { results, preflight } = await runFixtureHarness({
      scenarioFilter: 'high-confidence-incompatible',
    })
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      case: 'high-confidence-incompatible',
      pass: true,
    })
    expect(preflight).toEqual({
      scenarios: 1,
      jevCalls: 1,
      openaiCalls: 0,
      imagePairs: 0,
    })
  })

  it('rejects private fixture fields before providers can receive them', () => {
    expect(() =>
      assertPublicSafeFixture({
        report: { exactLocation: 'not allowed' },
        candidate: { storagePath: 'not allowed' },
      }),
    ).toThrow('Fixture field exactLocation is not public-safe.')
  })
})
