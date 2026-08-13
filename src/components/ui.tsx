import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export function Icon({ name }: { name: string }) { return <i className={`ri-${name}-line`} aria-hidden="true" /> }

export function PetSeenMark() { return <svg className="wordmark-mark" viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="7.5" cy="20.4" rx="5.2" ry="7" transform="rotate(-31 7.5 20.4)" /><ellipse cx="16.8" cy="9.7" rx="5.6" ry="7.3" transform="rotate(-7 16.8 9.7)" /><ellipse cx="31.2" cy="9.7" rx="5.6" ry="7.3" transform="rotate(7 31.2 9.7)" /><ellipse cx="40.5" cy="20.4" rx="5.2" ry="7" transform="rotate(31 40.5 20.4)" /><path d="M24 25.8c-5.1 0-8.4 4-11.4 7.8-2.8 3.4-6 5.2-6 8.8 0 3.7 3.5 6 7.8 6 3.7 0 5.7-1.6 9.6-1.6s5.9 1.6 9.6 1.6c4.3 0 7.8-2.3 7.8-6 0-3.6-3.2-5.4-6-8.8-3-3.8-6.3-7.8-11.4-7.8Z" /></svg> }

export function Progress({ label, total, current = 1 }: { label: string, total: number, current?: number }) { const { t } = useTranslation(); const step = t('missingCase.step', { current, total }); return <div className="progress" aria-label={step}><span className="progress-label">{label}</span><span>{step}</span><div className="progress-track"><span style={{ width: `${(current / total) * 100}%` }} /></div></div> }

export function PetImage({ className, petName, species, publicSlug, sourceUrl }: { className: string, petName: string, species: 'dog' | 'cat', publicSlug?: string, sourceUrl?: string | null }) {
  const fallback = `/images/generic-${species}.jpg`
  const publicUrl = publicSlug && import.meta.env.VITE_SUPABASE_URL ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/case-pet-photo?slug=${encodeURIComponent(publicSlug)}` : null
  const [src, setSrc] = useState(sourceUrl || publicUrl || fallback)
  useEffect(() => { setSrc(sourceUrl || publicUrl || fallback) }, [sourceUrl, publicUrl, fallback])
  return <img className={`${className} pet-placeholder`} src={src} alt={`Photo of ${petName}`} onError={() => setSrc(fallback)} />
}
