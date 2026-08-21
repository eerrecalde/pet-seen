/**
 * Keep query-key construction in one place so mutations can invalidate the
 * smallest affected cache entry without knowing a page's implementation.
 */
export const queryKeys = {
  publicCases: {
    all: ['public-cases'] as const,
    detail: (slug: string) => ['public-cases', 'detail', slug] as const,
    nearbyDiscovery: () => ['public-cases', 'nearby-discovery'] as const,
    options: () => ['public-cases', 'options'] as const,
  },
  ownerDashboard: (userId: string) => ['owner-dashboard', userId] as const,
  reporterFollowUp: (userId: string) => ['reporter-follow-up', userId] as const,
  watchAreas: (userId: string) => ['watch-areas', userId] as const,
  moderation: {
    access: (userId: string) => ['moderation', 'access', userId] as const,
    contentReports: () => ['moderation', 'content-reports'] as const,
    foundPetReports: () => ['moderation', 'found-pet-reports'] as const,
    unlinkedSightings: () => ['moderation', 'unlinked-sightings'] as const,
    foundPetCandidates: (reportId: string) =>
      ['moderation', 'found-pet-candidates', reportId] as const,
    sightingCandidates: (sightingId: string) =>
      ['moderation', 'sighting-candidates', sightingId] as const,
  },
  signedStorageUrl: (bucket: string, path: string) =>
    ['signed-storage-url', bucket, path] as const,
} as const
