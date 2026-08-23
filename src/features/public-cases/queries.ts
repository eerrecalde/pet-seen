import { queryOptions, useQuery } from '@tanstack/react-query'
import { queryKeys } from '../../lib/query-keys'
import {
  fetchNearbyDiscovery,
  fetchPublicCase,
  fetchPublicCaseOptions,
} from './api'

export const publicCaseQuery = (slug: string) =>
  queryOptions({
    queryKey: queryKeys.publicCases.detail(slug),
    queryFn: () => fetchPublicCase(slug),
  })

export const nearbyDiscoveryQuery = (latitude: number, longitude: number) =>
  queryOptions({
    queryKey: queryKeys.publicCases.nearbyDiscovery(latitude, longitude),
    queryFn: () => fetchNearbyDiscovery(latitude, longitude),
    staleTime: 60_000,
  })

export const publicCaseOptionsQuery = () =>
  queryOptions({
    queryKey: queryKeys.publicCases.options(),
    queryFn: fetchPublicCaseOptions,
    staleTime: 60_000,
  })

export function usePublicCaseQuery(slug: string | undefined) {
  return useQuery({ ...publicCaseQuery(slug ?? ''), enabled: Boolean(slug) })
}

export function useNearbyDiscoveryQuery(
  coordinates: { latitude: number; longitude: number } | null,
) {
  return useQuery({
    ...nearbyDiscoveryQuery(
      coordinates?.latitude ?? 0,
      coordinates?.longitude ?? 0,
    ),
    enabled: Boolean(coordinates),
  })
}

export function usePublicCaseOptionsQuery(enabled = true) {
  return useQuery({ ...publicCaseOptionsQuery(), enabled })
}
