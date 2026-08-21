import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../../lib/query-keys'
import { fetchReporterFollowUp } from './api'
export const useReporterFollowUpQuery = (userId?: string) => useQuery({ queryKey: queryKeys.reporterFollowUp(userId ?? ''), queryFn: () => fetchReporterFollowUp(userId ?? ''), enabled: Boolean(userId) })
