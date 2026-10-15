import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { scoreAttributeEvidence } from './pet-matching'

const matchingText = fc.string({ maxLength: 80 })
const options = { seed: 20_261_015, numRuns: 500 }

describe('PS-432 deterministic matching properties', () => {
  it('is symmetric when report and candidate evidence are exchanged', () => {
    fc.assert(
      fc.property(
        matchingText,
        matchingText,
        matchingText,
        matchingText,
        (reportBreed, caseBreed, reportColour, caseColour) => {
          expect(
            scoreAttributeEvidence({
              reportBreed,
              caseBreed,
              reportColour,
              caseColour,
            }),
          ).toEqual(
            scoreAttributeEvidence({
              reportBreed: caseBreed,
              caseBreed: reportBreed,
              reportColour: caseColour,
              caseColour: reportColour,
            }),
          )
        },
      ),
      options,
    )
  })

  it('keeps scores bounded and explanations consistent with evidence points', () => {
    fc.assert(
      fc.property(
        matchingText,
        matchingText,
        matchingText,
        matchingText,
        (reportBreed, caseBreed, reportColour, caseColour) => {
          const result = scoreAttributeEvidence({
            reportBreed,
            caseBreed,
            reportColour,
            caseColour,
          })
          expect([0, 5, 10]).toContain(result.breedPoints)
          expect([0, 2, 5]).toContain(result.colourPoints)
          expect(result.score).toBe(
            85 + result.breedPoints + result.colourPoints,
          )
          expect(result.score).toBeGreaterThanOrEqual(85)
          expect(result.score).toBeLessThanOrEqual(100)
          expect(result.reasons).toHaveLength(
            Number(result.breedPoints > 0) + Number(result.colourPoints > 0),
          )
        },
      ),
      options,
    )
  })
})
