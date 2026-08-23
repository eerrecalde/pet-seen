import { Icon } from './Icon'

export function PhotoPreviewHint({ label }: { label: string }) {
  return (
    <span aria-hidden="true" className="photo-preview-hint">
      <Icon name="zoom-in" />
      {label}
    </span>
  )
}
