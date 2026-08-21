const maxDimension = 2048
const maxSourceBytes = 10 * 1024 * 1024
const acceptedTypes = new Set(['image/jpeg', 'image/png'])

export class PetPhotoError extends Error {}

export async function preparePetPhoto(
  file: File,
  maxBytes = maxSourceBytes,
): Promise<File> {
  if (!acceptedTypes.has(file.type) || file.size > maxBytes)
    throw new PetPhotoError('unsupported')
  const image = await loadImage(file)
  const scale = Math.min(
    1,
    maxDimension / Math.max(image.naturalWidth, image.naturalHeight),
  )
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.84),
  )
  if (!blob) throw new PetPhotoError('encode')
  return new File(
    [blob],
    `${file.name.replace(/\.[^.]+$/, '') || 'pet-photo'}.jpg`,
    { type: 'image/jpeg', lastModified: Date.now() },
  )
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new PetPhotoError('decode'))
    }
    image.src = url
  })
}
