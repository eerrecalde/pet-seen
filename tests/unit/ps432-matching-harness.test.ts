import { describe, expect, it } from 'vitest'
import { runFixtureHarness } from '../../scripts/run-matching-harness.mjs'

describe('PS-432 fixture matching harness', () => {
  it('replays every synthetic scenario without provider calls or side effects', async () => {
    const { results } = await runFixtureHarness()
    expect(results).toHaveLength(8)
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
  })
})
