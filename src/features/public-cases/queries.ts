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

export const nearbyDiscoveryQuery = () =>
  queryOptions({
    queryKey: queryKeys.publicCases.nearbyDiscovery(),
    queryFn: fetchNearbyDiscovery,
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

export function useNearbyDiscoveryQuery() {
  return useQuery(nearbyDiscoveryQuery())
}

export function usePublicCaseOptionsQuery(enabled = true) {
  return useQuery({ ...publicCaseOptionsQuery(), enabled })
}
