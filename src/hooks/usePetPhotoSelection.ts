import { useState } from 'react'
export function usePetPhotoSelection() {
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoError, setPhotoError] = useState('')

  function setPreparedPhoto(file: File | null) {
    setPhoto(file)
    setPhotoError('')
  }

  return { photo, photoError, setPhotoError, setPreparedPhoto }
}
