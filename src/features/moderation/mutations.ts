import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../lib/query-keys'
import { moderationApi } from './api'

export function useModerationMutations() {
  const client = useQueryClient()
  const invalidateQueue = () =>
    client.invalidateQueries({ queryKey: queryKeys.moderation.queue() })
  const invalidateFoundCandidates = (reportId: string) =>
    client.invalidateQueries({
      queryKey: queryKeys.moderation.foundPetCandidates(reportId),
    })
  const invalidateSightingCandidates = (sightingId: string) =>
    client.invalidateQueries({
      queryKey: queryKeys.moderation.sightingCandidates(sightingId),
    })

  return {
    updateContentStatus: useMutation({
      mutationFn: ({ id, status }: { id: string; status: string }) =>
        moderationApi.updateContentStatus(id, status),
      onSuccess: invalidateQueue,
    }),
    housekeeping: useMutation({
      mutationFn: moderationApi.housekeeping,
      onSuccess: invalidateQueue,
    }),
    scoreSighting: useMutation({
      mutationFn: moderationApi.scoreSighting,
      onSuccess: (_, sightingId) => {
        void invalidateQueue()
        void invalidateSightingCandidates(sightingId)
      },
    }),
    linkSighting: useMutation({
      mutationFn: ({
        sightingId,
        caseId,
      }: {
        sightingId: string
        caseId: string
      }) => moderationApi.linkSighting(sightingId, caseId),
      onSuccess: (_, { sightingId }) => {
        void invalidateQueue()
        void invalidateSightingCandidates(sightingId)
      },
    }),
    scoreFound: useMutation({
      mutationFn: moderationApi.scoreFound,
      onSuccess: (_, reportId) => {
        void invalidateQueue()
        void invalidateFoundCandidates(reportId)
      },
    }),
    linkFound: useMutation({
      mutationFn: ({
        reportId,
        caseId,
      }: {
        reportId: string
        caseId: string
      }) => moderationApi.linkFound(reportId, caseId),
      onSuccess: (_, { reportId }) => {
        void invalidateQueue()
        void invalidateFoundCandidates(reportId)
      },
    }),
    reviewFound: useMutation({
      mutationFn: ({
        reportId,
        decision,
      }: {
        reportId: string
        decision: string
      }) => moderationApi.reviewFound(reportId, decision),
      onSuccess: invalidateQueue,
    }),
    manageFound: useMutation({
      mutationFn: ({
        reportId,
        action,
        reason,
      }: {
        reportId: string
        action: string
        reason: string
      }) => moderationApi.manageFound(reportId, action, reason),
      onSuccess: invalidateQueue,
    }),
  }
}
