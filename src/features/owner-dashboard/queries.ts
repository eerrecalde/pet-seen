import { queryOptions, useQuery } from '@tanstack/react-query'
import { queryKeys } from '../../lib/query-keys'
import { fetchOwnerDashboard, fetchSignedFoundPetPhoto, fetchSignedPetPhoto, fetchWatchAreas } from './api'
export const ownerDashboardQuery = (userId: string) => queryOptions({ queryKey: queryKeys.ownerDashboard(userId), queryFn: () => fetchOwnerDashboard(userId) })
export const watchAreasQuery = (userId: string) => queryOptions({ queryKey: queryKeys.watchAreas(userId), queryFn: () => fetchWatchAreas(userId) })
export const signedPetPhotoQuery = (path: string) => queryOptions({ queryKey: queryKeys.signedStorageUrl('pet-photos', path), queryFn: () => fetchSignedPetPhoto(path), staleTime: 45 * 60_000 })
export const signedFoundPetPhotoQuery = (path: string) => queryOptions({ queryKey: queryKeys.signedStorageUrl('found-pet-photos', path), queryFn: () => fetchSignedFoundPetPhoto(path), staleTime: 8 * 60_000 })
export const useOwnerDashboardQuery = (userId?: string) => useQuery({ ...ownerDashboardQuery(userId ?? ''), enabled: Boolean(userId) })
export const useWatchAreasQuery = (userId?: string) => useQuery({ ...watchAreasQuery(userId ?? ''), enabled: Boolean(userId) })
