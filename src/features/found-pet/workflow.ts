export type FoundPetSubmission = 'idle' | 'saving' | 'success' | 'error'

export type FoundPetWorkflowState = {
  submission: FoundPetSubmission
  error: string
}
export const initialFoundPetWorkflow: FoundPetWorkflowState = {
  submission: 'idle',
  error: '',
}

export type FoundPetWorkflowAction =
  | { type: 'start_submission' }
  | { type: 'submission_succeeded' }
  | { type: 'submission_failed'; error: string }
  | { type: 'validation_failed'; error: string }
  | { type: 'clear_error' }

export function foundPetWorkflowReducer(
  state: FoundPetWorkflowState,
  action: FoundPetWorkflowAction,
): FoundPetWorkflowState {
  switch (action.type) {
    case 'start_submission':
      return { submission: 'saving', error: '' }
    case 'submission_succeeded':
      return { submission: 'success', error: '' }
    case 'submission_failed':
      return { submission: 'error', error: action.error }
    case 'validation_failed':
      return { ...state, submission: 'idle', error: action.error }
    case 'clear_error':
      return { ...state, error: '' }
  }
}
