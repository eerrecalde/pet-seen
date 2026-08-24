import { useEffect, useState } from 'react'
import {
  publicPetPhotoUrl,
  type PublicPetPhotoVariant,
} from '../lib/public-pet-photo'

export type PetImageProps = {
  className: string
  petName: string
  species: 'dog' | 'cat'
  publicSlug?: string
  photoVersion?: string | null
  variant?: PublicPetPhotoVariant
  sourceUrl?: string | null
  onSourceChange?: (source: string) => void
}

/** Uses the public photo endpoint when available and safely falls back to a species image. */
export function PetImage({
  className,
  petName,
  species,
  publicSlug,
  photoVersion,
  variant,
  sourceUrl,
  onSourceChange,
}: PetImageProps) {
  const fallback = `/images/generic-${species}.jpg`
  const publicUrl = publicSlug
    ? publicPetPhotoUrl(publicSlug, photoVersion, variant)
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
