export async function photoPayload(photo: File | null) {
  if (!photo) return null
  const bytes = new Uint8Array(await photo.arrayBuffer())
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  return btoa(binary)
}
