import { useState } from 'react'
import { PetPhotoError, preparePetPhoto } from '../lib/prepare-pet-photo'

type PhotoSelectionOptions = {
  invalidMessage: string
  prepareErrorMessage: string
  maxBytes?: number
}

export function usePetPhotoSelection({
  invalidMessage,
  prepareErrorMessage,
  maxBytes,
}: PhotoSelectionOptions) {
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoError, setPhotoError] = useState('')

  async function choosePhoto(file: File | null) {
    setPhoto(null)
    setPhotoError('')
    if (!file) return
    try {
      setPhoto(await preparePetPhoto(file, maxBytes))
    } catch (cause) {
      setPhotoError(
        cause instanceof PetPhotoError ? invalidMessage : prepareErrorMessage,
      )
    }
  }

  return { choosePhoto, photo, photoError }
}
