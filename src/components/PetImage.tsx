import { useEffect, useState } from 'react'

export type PetImageProps = {
  className: string
  petName: string
  species: 'dog' | 'cat'
  publicSlug?: string
  sourceUrl?: string | null
  onSourceChange?: (source: string) => void
}

/** Uses the public photo endpoint when available and safely falls back to a species image. */
export function PetImage({
  className,
  petName,
  species,
  publicSlug,
  sourceUrl,
  onSourceChange,
}: PetImageProps) {
  const fallback = `/images/generic-${species}.jpg`
  const publicUrl =
    publicSlug && import.meta.env.VITE_SUPABASE_URL
      ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/case-pet-photo?slug=${encodeURIComponent(publicSlug)}`
      : null
  const [src, setSrc] = useState(sourceUrl || publicUrl || fallback)

  useEffect(() => {
    setSrc(sourceUrl || publicUrl || fallback)
  }, [sourceUrl, publicUrl, fallback])

  return (
    <img
      className={`${className} pet-placeholder`}
      src={src}
      alt={`Photo of ${petName}`}
      onLoad={(event) =>
        onSourceChange?.(event.currentTarget.currentSrc || src)
      }
      onError={() => setSrc(fallback)}
    />
  )
}
