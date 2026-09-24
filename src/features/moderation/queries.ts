import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { queryKeys } from '../../lib/query-keys'
import { moderationApi } from './api'

export const moderationAccessQuery = (userId: string) =>
  queryOptions({
    queryKey: queryKeys.moderation.access(userId),
    queryFn: moderationApi.isAuthorized,
  })

export const moderationQueueQuery = () =>
  queryOptions({
    queryKey: queryKeys.moderation.queue(),
    queryFn: moderationApi.load,
  })

export const foundPetCandidatesQuery = (reportId: string) =>
  queryOptions({
    queryKey: queryKeys.moderation.foundPetCandidates(reportId),
    queryFn: () => moderationApi.foundCandidates(reportId),
  })

export const sightingCandidatesQuery = (sightingId: string) =>
  queryOptions({
    queryKey: queryKeys.moderation.sightingCandidates(sightingId),
    queryFn: () => moderationApi.sightingCandidates(sightingId),
  })

export const moderationPhotoQuery = (path: string) =>
  queryOptions({
    queryKey: queryKeys.signedStorageUrl('found-pet-photos', path),
    queryFn: () => moderationApi.signedPhoto(path),
    staleTime: 45_000,
  })

export function useModerationAccessQuery(userId?: string) {
  return useQuery({
    ...moderationAccessQuery(userId ?? ''),
    enabled: Boolean(userId),
  })
}

export function useModerationQueueQuery(enabled: boolean) {
  return useQuery({ ...moderationQueueQuery(), enabled })
}

export function useModerationCandidateLoader() {
  const client = useQueryClient()
  return {
    loadFound: (reportId: string) =>
      client.fetchQuery(foundPetCandidatesQuery(reportId)),
    loadSighting: (sightingId: string) =>
      client.fetchQuery(sightingCandidatesQuery(sightingId)),
  }
}

export function useModerationPhotoLoader() {
  const client = useQueryClient()
  return useCallback(
    (path: string) => client.fetchQuery(moderationPhotoQuery(path)),
    [client],
  )
}
