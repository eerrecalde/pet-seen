import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from './Modal'
import { PetImage, type PetImageProps } from './PetImage'
import { PhotoPreviewHint } from './PhotoPreviewHint'

type ExpandablePetImageProps = PetImageProps

/** Shows a compact pet image first, with a full image available on demand. */
export function ExpandablePetImage(props: ExpandablePetImageProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [resolvedSourceUrl, setResolvedSourceUrl] = useState<string>()
  const { petName } = props
  const fallback = `/images/generic-${props.species}.jpg`

  return (
    <>
      <button
        aria-label={`View full photo of ${petName}`}
        className="photo-preview-button"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <PetImage {...props} onSourceChange={setResolvedSourceUrl} />
        <PhotoPreviewHint label={t('common.viewFullPhoto')} />
      </button>
      <Modal
        contentClassName="modal-photo-content"
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={petName}
      >
        <PetImage
          {...props}
          className="modal-photo"
          sourceUrl={resolvedSourceUrl ?? props.sourceUrl ?? fallback}
        />
      </Modal>
    </>
  )
}
