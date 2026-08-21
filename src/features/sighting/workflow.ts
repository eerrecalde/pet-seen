export type SightingLocation = {
  label: string
  latitude: string
  longitude: string
  seenAt: string
  details: string
}
export type SightingDraft = {
  selectedCase: string
  location: SightingLocation
  submissionToken: string
}
export type SightingSubmission =
  'idle' | 'saving' | 'success' | 'error' | 'offline'

export type SightingWorkflowState = {
  selectedCase: string
  location: SightingLocation
  submission: SightingSubmission
  error: string
  draftRestored: boolean
  isOnline: boolean
  isCasePickerOpen: boolean
}

export function createInitialSightingWorkflow(
  location: SightingLocation,
  isOnline: boolean,
): SightingWorkflowState {
  return {
    selectedCase: '',
    location,
    submission: 'idle',
    error: '',
    draftRestored: false,
    isOnline,
    isCasePickerOpen: false,
  }
}

export type SightingWorkflowAction =
  | { type: 'restore_draft'; draft: SightingDraft }
  | { type: 'set_online'; isOnline: boolean }
  | { type: 'open_case_picker' }
  | { type: 'close_case_picker' }
  | { type: 'choose_case'; caseSlug: string }
  | { type: 'clear_case' }
  | { type: 'update_location'; location: SightingLocation }
  | { type: 'start_submission' }
  | { type: 'submission_succeeded' }
  | { type: 'submission_failed'; error: string }
  | { type: 'submission_saved_offline' }
  | { type: 'validation_failed'; error: string }
  | { type: 'clear_error' }

export function sightingWorkflowReducer(
  state: SightingWorkflowState,
  action: SightingWorkflowAction,
): SightingWorkflowState {
  switch (action.type) {
    case 'restore_draft':
      return {
        ...state,
        selectedCase: action.draft.selectedCase,
        location: action.draft.location,
        draftRestored: true,
      }
    case 'set_online':
      return { ...state, isOnline: action.isOnline }
    case 'open_case_picker':
      return { ...state, isCasePickerOpen: true }
    case 'close_case_picker':
      return { ...state, isCasePickerOpen: false }
    case 'choose_case':
      return {
        ...state,
        selectedCase: action.caseSlug,
        isCasePickerOpen: false,
      }
    case 'clear_case':
      return { ...state, selectedCase: '', isCasePickerOpen: false }
    case 'update_location':
      return { ...state, location: action.location }
    case 'start_submission':
      return { ...state, submission: 'saving', error: '' }
    case 'submission_succeeded':
      return { ...state, submission: 'success', error: '' }
    case 'submission_failed':
      return { ...state, submission: 'error', error: action.error }
    case 'submission_saved_offline':
      return { ...state, submission: 'offline', error: '' }
    case 'validation_failed':
      return { ...state, submission: 'idle', error: action.error }
    case 'clear_error':
      return { ...state, error: '' }
  }
}
