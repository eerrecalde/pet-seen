import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../lib/query-keys'
import {
  createWatchArea,
  deleteOwnerCase,
  deleteWatchArea,
  enableOwnerPushNotifications,
  reviewFoundMatch,
  reviewOwnerSighting,
  sendFoundPetMessage,
  setOwnerCaseStatus,
  updateOwnerCase,
} from './api'
const invalidateOwner = (
  client: ReturnType<typeof useQueryClient>,
  userId: string,
) => client.invalidateQueries({ queryKey: queryKeys.ownerDashboard(userId) })

const invalidatePublicCases = (client: ReturnType<typeof useQueryClient>) =>
  client.invalidateQueries({ queryKey: queryKeys.publicCases.all })
export function useOwnerMutations(userId: string) {
  const client = useQueryClient()
  return {
    updateCase: useMutation({
      mutationFn: updateOwnerCase,
      onSuccess: () => {
        void invalidateOwner(client, userId)
        void invalidatePublicCases(client)
      },
    }),
    setStatus: useMutation({
      mutationFn: setOwnerCaseStatus,
      onSuccess: () => {
        void invalidateOwner(client, userId)
        void invalidatePublicCases(client)
      },
    }),
    deleteCase: useMutation({
      mutationFn: deleteOwnerCase,
      onSuccess: () => {
        void invalidateOwner(client, userId)
        void invalidatePublicCases(client)
      },
    }),
    reviewSighting: useMutation({
      mutationFn: reviewOwnerSighting,
      onSuccess: () => invalidateOwner(client, userId),
    }),
    reviewFoundMatch: useMutation({
      mutationFn: reviewFoundMatch,
      onSuccess: () => invalidateOwner(client, userId),
    }),
    createWatchArea: useMutation({
      mutationFn: createWatchArea,
      onSuccess: () =>
        client.invalidateQueries({ queryKey: queryKeys.watchAreas(userId) }),
    }),
    deleteWatchArea: useMutation({
      mutationFn: deleteWatchArea,
      onSuccess: () =>
        client.invalidateQueries({ queryKey: queryKeys.watchAreas(userId) }),
    }),
    sendMessage: useMutation({
      mutationFn: sendFoundPetMessage,
      onSuccess: () => invalidateOwner(client, userId),
    }),
    enablePush: useMutation({ mutationFn: enableOwnerPushNotifications }),
  }
}
