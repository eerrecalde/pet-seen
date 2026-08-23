import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

type ModalProps = {
  ariaLabel?: string
  children: ReactNode
  contentClassName?: string
  isOpen: boolean
  onClose: () => void
  title?: string
}

/** A shared dialog frame for content that needs a focused, dismissible overlay. */
export function Modal({
  ariaLabel,
  children,
  contentClassName,
  isOpen,
  onClose,
  title,
}: ModalProps) {
  const titleId = useId()
  const closeButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const activeElement = document.activeElement as HTMLElement | null
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onKeyDown)
    closeButton.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      activeElement?.focus()
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-label={title ? undefined : ariaLabel}
        aria-labelledby={title ? titleId : undefined}
        aria-modal="true"
        className="modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div
          className={`modal-header${title ? '' : ' modal-header-close-only'}`}
        >
          {title && <h2 id={titleId}>{title}</h2>}
          <button
            aria-label="Close dialog"
            className="modal-close"
            onClick={onClose}
            ref={closeButton}
            type="button"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className={`modal-content ${contentClassName ?? ''}`.trim()}>
          {children}
        </div>
      </section>
    </div>,
    document.body,
  )
}
