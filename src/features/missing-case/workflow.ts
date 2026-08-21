export type MissingCaseStage = 'details' | 'location' | 'published'
export type MissingCaseSubmission = 'idle' | 'saving' | 'error'

export type MissingCaseWorkflowState = {
  stage: MissingCaseStage
  submission: MissingCaseSubmission
  error: string
}

export const initialMissingCaseWorkflow: MissingCaseWorkflowState = {
  stage: 'details',
  submission: 'idle',
  error: '',
}

export type MissingCaseWorkflowAction =
  | { type: 'start_submission' }
  | { type: 'draft_saved' }
  | { type: 'published' }
  | { type: 'failed'; error: string }
  | { type: 'validation_failed'; error: string }
  | { type: 'clear_error' }

export function missingCaseWorkflowReducer(
  state: MissingCaseWorkflowState,
  action: MissingCaseWorkflowAction,
): MissingCaseWorkflowState {
  switch (action.type) {
    case 'start_submission':
      return { ...state, submission: 'saving', error: '' }
    case 'draft_saved':
      return { stage: 'location', submission: 'idle', error: '' }
    case 'published':
      return { stage: 'published', submission: 'idle', error: '' }
    case 'failed':
      return { ...state, submission: 'error', error: action.error }
    case 'validation_failed':
      return { ...state, submission: 'idle', error: action.error }
    case 'clear_error':
      return { ...state, error: '' }
  }
}
