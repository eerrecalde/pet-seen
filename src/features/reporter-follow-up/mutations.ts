import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../lib/query-keys'
import { sendReporterMessage } from './api'
export function useReporterMessageMutation(userId: string) { const client = useQueryClient(); return useMutation({ mutationFn: sendReporterMessage, onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.reporterFollowUp(userId) }) }) }
