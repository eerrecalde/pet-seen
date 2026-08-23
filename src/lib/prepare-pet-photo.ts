const maxDimension = 2048
const maxSourceBytes = 10 * 1024 * 1024
const acceptedTypes = new Set(['image/jpeg', 'image/png'])

export class PetPhotoError extends Error {}

export function validatePetPhoto(file: File, maxBytes = maxSourceBytes) {
  if (!acceptedTypes.has(file.type) || file.size > maxBytes)
    throw new PetPhotoError('unsupported')
}

export type PhotoCrop = {
  height: number
  width: number
  x: number
  y: number
}

export async function preparePetPhoto(
  file: File,
  maxBytes = maxSourceBytes,
  crop?: PhotoCrop,
): Promise<File> {
  validatePetPhoto(file, maxBytes)
  const image = await loadImage(file)
  const source = crop
    ? clampCrop(crop, image.naturalWidth, image.naturalHeight)
    : { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight }
  const scale = Math.min(
    1,
    maxDimension / Math.max(source.width, source.height),
  )
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(source.width * scale))
  canvas.height = Math.max(1, Math.round(source.height * scale))
  canvas
    .getContext('2d')
    ?.drawImage(
      image,
      source.x,
      source.y,
      source.width,
      source.height,
      0,
      0,
      canvas.width,
      canvas.height,
    )
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

function clampCrop(crop: PhotoCrop, imageWidth: number, imageHeight: number) {
  const width = Math.max(1, Math.min(crop.width, imageWidth))
  const height = Math.max(1, Math.min(crop.height, imageHeight))
  return {
    width,
    height,
    x: Math.max(0, Math.min(crop.x, imageWidth - width)),
    y: Math.max(0, Math.min(crop.y, imageHeight - height)),
  }
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
