import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  PetPhotoError,
  preparePetPhoto,
  validatePetPhoto,
  type PhotoCrop,
} from '../lib/prepare-pet-photo'
import { Icon } from './Icon'

type PetPhotoUploadFieldProps = {
  accept: string
  addLabel: string
  error?: string
  hint: string
  invalidMessage: string
  maxBytes?: number
  onChange: (file: File | null) => void
  onError: (message: string) => void
  photo: File | null
  prepareErrorMessage: string
}

export function PetPhotoUploadField(props: PetPhotoUploadFieldProps) {
  const {
    accept,
    addLabel,
    error,
    hint,
    invalidMessage,
    maxBytes,
    onChange,
    onError,
    photo,
    prepareErrorMessage,
  } = props
  const inputRef = useRef<HTMLInputElement>(null)
  const [source, setSource] = useState<File | null>(null)
  const [sourceUrl, setSourceUrl] = useState('')
  useEffect(() => {
    if (!source) {
      setSourceUrl('')
      return
    }
    const url = URL.createObjectURL(source)
    setSourceUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [source])
  function selectFile(file: File | null) {
    onError('')
    if (!file) return
    try {
      validatePetPhoto(file, maxBytes)
      onChange(null)
      setSource(file)
    } catch (cause) {
      onChange(null)
      onError(
        cause instanceof PetPhotoError ? invalidMessage : prepareErrorMessage,
      )
    }
  }
  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0] ?? null)
    event.target.value = ''
  }
  async function finish(crop?: PhotoCrop) {
    if (!source) return
    try {
      onChange(await preparePetPhoto(source, maxBytes, crop))
      onError('')
      setSource(null)
    } catch (cause) {
      onError(
        cause instanceof PetPhotoError ? invalidMessage : prepareErrorMessage,
      )
    }
  }
  return (
    <>
      <label className="upload-field">
        <Icon name="image-add" />
        <span>
          <strong>{photo ? photo.name : addLabel}</strong>
          <small>{hint}</small>
        </span>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleInput}
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {source && sourceUrl && (
        <PhotoAdjustmentDialog
          imageUrl={sourceUrl}
          onConfirm={finish}
          onReplace={() => inputRef.current?.click()}
          onSkip={() => void finish()}
        />
      )}
    </>
  )
}

type DialogProps = {
  imageUrl: string
  onConfirm: (crop: PhotoCrop) => void
  onReplace: () => void
  onSkip: () => void
}

function PhotoAdjustmentDialog({
  imageUrl,
  onConfirm,
  onReplace,
  onSkip,
}: DialogProps) {
  const { t } = useTranslation()
  const cropRef = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchDistance = useRef<number | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  function limitOffset(next: { x: number; y: number }, nextZoom = zoom) {
    const box = cropRef.current?.getBoundingClientRect()
    if (!box || !imageSize.width || !imageSize.height) return next
    const base = Math.max(
      box.width / imageSize.width,
      box.height / imageSize.height,
    )
    const drawnWidth = imageSize.width * base * nextZoom,
      drawnHeight = imageSize.height * base * nextZoom
    return {
      x: Math.max(
        -(drawnWidth - box.width) / 2,
        Math.min((drawnWidth - box.width) / 2, next.x),
      ),
      y: Math.max(
        -(drawnHeight - box.height) / 2,
        Math.min((drawnHeight - box.height) / 2, next.y),
      ),
    }
  }
  function updateZoom(nextZoom: number) {
    const safeZoom = Math.max(1, Math.min(3, nextZoom))
    setZoom(safeZoom)
    setOffset((current) => limitOffset(current, safeZoom))
  }
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinchDistance.current = Math.hypot(a.x - b.x, a.y - b.y)
    }
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId)
    if (!previous) return
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    })
    if (pointers.current.size === 1) {
      setOffset((current) =>
        limitOffset({
          x: current.x + event.clientX - previous.x,
          y: current.y + event.clientY - previous.y,
        }),
      )
      return
    }
    const [a, b] = [...pointers.current.values()],
      distance = Math.hypot(a.x - b.x, a.y - b.y)
    if (pinchDistance.current)
      updateZoom(zoom * (distance / pinchDistance.current))
    pinchDistance.current = distance
  }
  function pointerEnd(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) pinchDistance.current = null
  }
  function confirm() {
    const box = cropRef.current?.getBoundingClientRect()
    if (!box || !imageSize.width || !imageSize.height) return
    const scale =
      Math.max(box.width / imageSize.width, box.height / imageSize.height) *
      zoom
    onConfirm({
      x: (box.width / 2 - (imageSize.width * scale) / 2 - offset.x) / scale,
      y: (box.height / 2 - (imageSize.height * scale) / 2 - offset.y) / scale,
      width: box.width / scale,
      height: box.height / scale,
    })
  }
  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const amount = event.shiftKey ? 20 : 8
    const moves: Record<string, { x: number; y: number }> = {
      ArrowDown: { x: 0, y: -amount },
      ArrowLeft: { x: amount, y: 0 },
      ArrowRight: { x: -amount, y: 0 },
      ArrowUp: { x: 0, y: amount },
    }
    if (moves[event.key]) {
      event.preventDefault()
      setOffset((current) =>
        limitOffset({
          x: current.x + moves[event.key].x,
          y: current.y + moves[event.key].y,
        }),
      )
    }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault()
      updateZoom(zoom + 0.1)
    }
    if (event.key === '-') {
      event.preventDefault()
      updateZoom(zoom - 0.1)
    }
  }
  return (
    <section
      className="photo-adjustment"
      aria-labelledby="photo-adjustment-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="photo-adjustment-heading">
        <div>
          <h2 id="photo-adjustment-title">
            {t('common.photoAdjustment.title')}
          </h2>
          <p>{t('common.photoAdjustment.help')}</p>
        </div>
        <button
          className="text-button"
          type="button"
          onClick={() => {
            setZoom(1)
            setOffset({ x: 0, y: 0 })
          }}
        >
          {t('common.photoAdjustment.reset')}
        </button>
      </div>
      <div
        ref={cropRef}
        className="photo-crop-area"
        aria-label={t('common.photoAdjustment.cropArea')}
        role="application"
        tabIndex={0}
        onKeyDown={move}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerEnd}
        onPointerCancel={pointerEnd}
      >
        <img
          className={
            imageSize.width / Math.max(imageSize.height, 1) > 4 / 3
              ? 'wide'
              : 'tall'
          }
          src={imageUrl}
          alt={t('common.photoAdjustment.selectedPhoto')}
          draggable={false}
          onLoad={(event) =>
            setImageSize({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })
          }
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          }}
        />
      </div>
      <label className="photo-zoom">
        {t('common.photoAdjustment.zoom')}{' '}
        <input
          aria-label={t('common.photoAdjustment.zoom')}
          type="range"
          min="1"
          max="3"
          step="0.01"
          value={zoom}
          onChange={(event) => updateZoom(Number(event.target.value))}
        />
      </label>
      <div className="photo-adjustment-actions">
        <button className="secondary-button" type="button" onClick={onSkip}>
          {t('common.photoAdjustment.skip')}
        </button>
        <button className="secondary-button" type="button" onClick={onReplace}>
          {t('common.photoAdjustment.replace')}
        </button>
        <button className="primary-cta" type="button" onClick={confirm}>
          {t('common.photoAdjustment.usePhoto')}
        </button>
      </div>
    </section>
  )
}
