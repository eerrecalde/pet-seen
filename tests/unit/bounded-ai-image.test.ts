import { describe, expect, it } from 'vitest'

const maxAiImageBytes = 1_500_000
const maxAiImageDimension = 1600

function jpegDimensions(bytes: Uint8Array) {
  for (let index = 2; index + 9 < bytes.length;) {
    if (bytes[index] !== 0xff) return null
    const marker = bytes[index + 1]
    const length = (bytes[index + 2] << 8) | bytes[index + 3]
    if (length < 2) return null
    if (marker >= 0xc0 && marker <= 0xc3)
      return {
        height: (bytes[index + 5] << 8) | bytes[index + 6],
        width: (bytes[index + 7] << 8) | bytes[index + 8],
      }
    index += length + 2
  }
  return null
}
function permitted(bytes: Uint8Array) {
  const dimensions = jpegDimensions(bytes)
  return Boolean(
    dimensions &&
    bytes.byteLength <= maxAiImageBytes &&
    dimensions.width <= maxAiImageDimension &&
    dimensions.height <= maxAiImageDimension,
  )
}
function jpeg(width: number, height: number) {
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0x00,
    0x0b,
    0x08,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    0x03,
  ])
}

describe('PS-426 AI image caps', () => {
  it('accepts a JPEG within byte and dimension caps', () => {
    expect(permitted(jpeg(1600, 1600))).toBe(true)
  })
  it('skips malformed and oversized dimensions', () => {
    expect(permitted(new Uint8Array([0xff, 0xd8]))).toBe(false)
    expect(permitted(jpeg(1601, 1600))).toBe(false)
    expect(permitted(jpeg(1600, 1601))).toBe(false)
  })
  it('skips bytes over the provider cap', () => {
    const bytes = new Uint8Array(maxAiImageBytes + 1)
    bytes.set(jpeg(10, 10))
    expect(permitted(bytes)).toBe(false)
  })
})
