import { describe, expect, it } from 'vitest'
import {
  initialMissingCaseWorkflow,
  missingCaseWorkflowReducer,
} from '../../src/features/missing-case/workflow'
import {
  initialFoundPetWorkflow,
  foundPetWorkflowReducer,
} from '../../src/features/found-pet/workflow'
import {
  createInitialSightingWorkflow,
  sightingWorkflowReducer,
} from '../../src/features/sighting/workflow'

describe('PS-420 workflow reducers', () => {
  it('moves a missing-case draft through its explicit stages and retains validation feedback', () => {
    const saving = missingCaseWorkflowReducer(initialMissingCaseWorkflow, {
      type: 'start_submission',
    })
    const location = missingCaseWorkflowReducer(saving, { type: 'draft_saved' })
    const invalid = missingCaseWorkflowReducer(location, {
      type: 'validation_failed',
      error: 'Choose a location.',
    })

    expect(location).toMatchObject({ stage: 'location', submission: 'idle' })
    expect(invalid).toMatchObject({
      stage: 'location',
      submission: 'idle',
      error: 'Choose a location.',
    })
    expect(
      missingCaseWorkflowReducer(invalid, { type: 'published' }),
    ).toMatchObject({ stage: 'published', submission: 'idle', error: '' })
  })

  it('restores, saves offline, and retries a sighting without losing its draft data', () => {
    const initial = createInitialSightingWorkflow(
      {
        label: '',
        latitude: '',
        longitude: '',
        seenAt: '2026-08-21T10:00',
        details: '',
      },
      false,
    )
    const restored = sightingWorkflowReducer(initial, {
      type: 'restore_draft',
      draft: {
        selectedCase: 'milo',
        location: {
          label: 'Victoria Park',
          latitude: '51.536',
          longitude: '-0.038',
          seenAt: '2026-08-21T10:00',
          details: 'Near the gate',
        },
        submissionToken: 'draft-token',
      },
    })
    const offline = sightingWorkflowReducer(
      sightingWorkflowReducer(restored, { type: 'start_submission' }),
      { type: 'submission_saved_offline' },
    )
    const retrying = sightingWorkflowReducer(
      sightingWorkflowReducer(offline, { type: 'set_online', isOnline: true }),
      { type: 'start_submission' },
    )

    expect(offline).toMatchObject({
      submission: 'offline',
      draftRestored: true,
      selectedCase: 'milo',
      location: { label: 'Victoria Park' },
    })
    expect(retrying).toMatchObject({
      submission: 'saving',
      isOnline: true,
      selectedCase: 'milo',
      location: { details: 'Near the gate' },
    })
  })

  it('keeps found-pet submission and validation outcomes explicit', () => {
    const invalid = foundPetWorkflowReducer(initialFoundPetWorkflow, {
      type: 'validation_failed',
      error: 'Place the pin on the map.',
    })
    const saving = foundPetWorkflowReducer(invalid, {
      type: 'start_submission',
    })

    expect(invalid).toMatchObject({
      submission: 'idle',
      error: 'Place the pin on the map.',
    })
    expect(
      foundPetWorkflowReducer(saving, {
        type: 'submission_failed',
        error: 'Try again.',
      }),
    ).toMatchObject({ submission: 'error', error: 'Try again.' })
    expect(
      foundPetWorkflowReducer(saving, { type: 'submission_succeeded' }),
    ).toEqual({ submission: 'success', error: '' })
  })
})
