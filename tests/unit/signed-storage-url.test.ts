import { describe, expect, it } from 'vitest'
import { signedStorageUrl } from '../../src/lib/supabase-error'

describe('signedStorageUrl', () => {
  it('accepts the hosted and local Storage response field names', () => {
    expect(signedStorageUrl({ signedUrl: 'https://example.com/hosted' })).toBe(
      'https://example.com/hosted',
    )
    expect(signedStorageUrl({ signedURL: '/object/sign/local' })).toBe(
      '/object/sign/local',
    )
  })

  it('returns null when Storage has no usable URL', () => {
    expect(signedStorageUrl(null)).toBeNull()
  })
})
