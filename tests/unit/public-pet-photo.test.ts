import { describe, expect, it } from 'vitest'
import { publicPetPhotoUrl } from '../../src/lib/public-pet-photo'

describe('PS-428 public pet-photo URLs', () => {
  const slug = 'abc123def4'
  const version = '2c5e0e0a-6b41-4e80-9d3d-f31c1171fb67-1780000000'

  it('returns no route until a processed public version is available', () => {
    expect(publicPetPhotoUrl(slug, null)).toBeNull()
  })

  it('uses a versioned card route rather than a Storage or signed URL', () => {
    const url = publicPetPhotoUrl(slug, version, 'card')

    if (import.meta.env.VITE_SUPABASE_URL) {
      expect(url).toContain('case-pet-photo?')
      expect(url).toContain('variant=card')
      expect(url).toContain(`v=${version}`)
      expect(url).not.toContain('/storage/v1/')
      expect(url).not.toContain('token=')
    } else {
      expect(url).toBeNull()
    }
  })
})
