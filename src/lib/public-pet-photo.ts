export type PublicPetPhotoVariant = 'card' | 'display'

/**
 * This route is deliberately stable for a processed photo version. It is not a
 * Storage URL: the Edge Function still checks that the case remains published
 * before returning a private derivative.
 */
export function publicPetPhotoUrl(
  slug: string,
  version: string | null | undefined,
  variant: PublicPetPhotoVariant = 'display',
) {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!baseUrl || !slug || !version) return null

  const params = new URLSearchParams({ slug, variant, v: version })
  return `${baseUrl}/functions/v1/case-pet-photo?${params.toString()}`
}
