import { QueryClient } from '@tanstack/react-query'

/**
 * The single cache for server data. Feature queries choose their own stale time
 * when a different freshness guarantee is needed.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
    mutations: {
      retry: 0,
    },
  },
})
