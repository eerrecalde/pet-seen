import { describe, expect, it } from 'vitest'
import { evaluate } from '../../scripts/run-jev-shadow-evaluation.mjs'

describe('PS-430 synthetic shadow evaluation', () => {
  it('reports recall, incompatible precision, calibration and a conservative gate', () => {
    expect(
      evaluate([
        { label: 'same_pet', probability: 0.9, route: 'possible' },
        { label: 'different_pet', probability: 0.03, route: 'incompatible' },
        { label: 'different_pet', probability: 0.6, route: 'uncertain' },
      ]),
    ).toEqual({
      cases: 3,
      positiveRecall: 1,
      incompatiblePrecision: 1,
      calibrationBrier: 0.1236,
      proposedVisionGate: {
        probabilityAtMost: 0.2,
        route: 'incompatible',
        gated: 1,
        falseNegatives: 0,
      },
    })
  })
})
