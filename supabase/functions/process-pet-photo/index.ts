import { createClient } from '@supabase/supabase-js'
import { Image } from 'imagescript'

const maxPixels = 40_000_000
const displayMaxDimension = 1600

type PhotoRecord = {
  id: string
  owner_id: string
  source_object_path: string
  status: 'pending' | 'processed' | 'failed'
}

function detectedFormat(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg' as const
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png' as const
  return null
}

function response(status: number, body: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

Deno.serve(async (request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return response(500, { error: 'Photo processing is unavailable.' })

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { data: authData } = token ? await admin.auth.getUser(token) : { data: { user: null } }
  if (!authData.user) return response(401, { error: 'Sign in is required.' })

  const { photoId } = await request.json().catch(() => ({ photoId: null })) as { photoId?: string | null }
  if (!photoId) return response(400, { error: 'A photo is required.' })
  const { data: photo } = await admin.from('pet_photos').select('id, owner_id, source_object_path, status').eq('id', photoId).maybeSingle<PhotoRecord>()
  if (!photo || photo.owner_id !== authData.user.id) return response(404, { error: 'Photo not found.' })
  if (photo.status === 'processed') return response(200, { status: 'processed' })

  try {
    const { data: source, error: downloadError } = await admin.storage.from('pet-photos').download(photo.source_object_path)
    if (downloadError || !source) throw new Error('source download failed')
    const bytes = new Uint8Array(await source.arrayBuffer())
    const format = detectedFormat(bytes)
    if (!format) throw new Error('unsupported image format')
    const image = await Image.decode(bytes)
    if (image.width * image.height > maxPixels) throw new Error('image dimensions are too large')
    const scale = Math.min(1, displayMaxDimension / Math.max(image.width, image.height))
    if (scale < 1) image.resize('cubic', Math.round(image.width * scale), Math.round(image.height * scale))

    // Re-encoding drops EXIF, XMP and other source metadata before this file can be displayed.
    const displayObjectPath = `${photo.owner_id}/display/${photo.id}.jpg`
    const displayBytes = await image.encode('jpeg', { quality: 82 })
    const { error: uploadError } = await admin.storage.from('pet-photos').upload(displayObjectPath, displayBytes, { contentType: 'image/jpeg', upsert: true })
    if (uploadError) throw new Error('display upload failed')
    const { error: updateError } = await admin.from('pet_photos').update({ status: 'processed', display_object_path: displayObjectPath, processed_at: new Date().toISOString(), processing_error: null }).eq('id', photo.id)
    if (updateError) throw new Error('photo record update failed')
    return response(200, { status: 'processed' })
  } catch (error) {
    console.error('Pet photo processing failed', error)
    await admin.from('pet_photos').update({ status: 'failed', display_object_path: null, processing_error: 'We could not process this photo. Please choose a different image.' }).eq('id', photo.id)
    return response(422, { error: 'We could not process this photo.' })
  }
})
