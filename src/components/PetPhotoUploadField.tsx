import { Icon } from './Icon'

type PetPhotoUploadFieldProps = {
  accept: string
  addLabel: string
  error?: string
  hint: string
  onChange: (file: File | null) => void | Promise<void>
  photo: File | null
}

export function PetPhotoUploadField({
  accept,
  addLabel,
  error,
  hint,
  onChange,
  photo,
}: PetPhotoUploadFieldProps) {
  return (
    <>
      <label className="upload-field">
        <Icon name="image-add" />
        <span>
          <strong>{photo ? photo.name : addLabel}</strong>
          <small>{hint}</small>
        </span>
        <input
          type="file"
          accept={accept}
          onChange={(event) => void onChange(event.target.files?.[0] ?? null)}
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  )
}
