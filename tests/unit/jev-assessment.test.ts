import { describe, expect, it, vi } from 'vitest'
import {
  JEV_MODEL,
  JEV_RUBRIC_VERSION,
  assessFoundPetCandidate,
  buildJevAssessmentRequest,
} from '../../supabase/functions/_shared/jev-assessment.js'

const assessment = {
  model: JEV_MODEL,
  answers: {
    breed: {
      choice: 'compatible',
      probabilities: { compatible: 0.86, incompatible: 0.04, uncertain: 0.1 },
      confidence: 'high',
    },
    markings: {
      choice: 'uncertain',
      probabilities: { compatible: 0.3, incompatible: 0.2, uncertain: 0.5 },
      confidence: 'medium',
    },
    report_details: {
      choice: 'compatible',
      probabilities: { compatible: 0.76, incompatible: 0.09, uncertain: 0.15 },
      confidence: 'high',
    },
  },
  usage: { input_tokens: 123, output_tokens: 0 },
}

const input = {
  found: {
    species: 'dog',
    breed: 'Labrador',
    colour: 'black with a white chest patch',
    details: 'Friendly dog wearing a red collar.',
  },
  candidate: {
    species: 'dog',
    breed: 'Labrador Retriever',
    colour: 'black',
    details: 'White patch on chest; red collar.',
  },
  distanceKm: 2.4,
  elapsedHours: 18,
}

describe('Jev found-pet assessment', () => {
  it('builds one pinned, text-only atomic-rubric request', () => {
    const request = buildJevAssessmentRequest(input)

    expect(request.model).toBe(JEV_MODEL)
    expect(request.rubricVersion).toBe(JEV_RUBRIC_VERSION)
    expect(Object.keys(request.questions)).toEqual([
      'breed',
      'markings',
      'report_details',
    ])
    expect(request.state).toEqual({
      found: input.found,
      candidate: input.candidate,
      distance_km: 2.4,
      elapsed_hours: 18,
    })
    expect(JSON.stringify(request.state)).not.toMatch(
      /case_id|location|latitude|longitude|email|phone|path|image/i,
    )
  })

  it('redacts contact details from text before they reach the provider', () => {
    const request = buildJevAssessmentRequest({
      ...input,
      found: {
        ...input.found,
        details:
          'Call +44 7700 900123 or name@example.test about the red collar.',
      },
    })

    expect(JSON.stringify(request.state)).not.toContain('7700')
    expect(JSON.stringify(request.state)).not.toContain('example.test')
    expect(request.state.found.details).toContain('[redacted]')
  })

  it('represents an unknown elapsed time without inventing a date', () => {
    const request = buildJevAssessmentRequest({
      ...input,
      elapsedHours: null,
    })

    expect(request.state.elapsed_hours).toBeNull()
  })

  it('maps the typed response to three stored rubric outcomes', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(assessment), { status: 200 }),
      )

    const result = await assessFoundPetCandidate({
      apiKey: 'test-key',
      fetcher,
      input,
    })

    expect(fetcher).toHaveBeenCalledWith(
      'https://api.typesafe.ai/v1/systemone',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result).toMatchObject({
      model: JEV_MODEL,
      rubricVersion: JEV_RUBRIC_VERSION,
      route: 'possible',
      probability: 0.3,
      confidence: 'medium',
      usage: { inputTokens: 123, outputTokens: 0 },
    })
    expect(result.dimensions).toHaveLength(3)
  })

  it.each([429, 529])(
    'marks provider status %i as retryable',
    async (status) => {
      const fetcher = vi.fn().mockResolvedValue(new Response('', { status }))

      await expect(
        assessFoundPetCandidate({ apiKey: 'test-key', fetcher, input }),
      ).rejects.toMatchObject({ retryable: true, status })
    },
  )
})
