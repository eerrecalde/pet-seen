import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { LocationPicker } from '../../components/maps/LocationPicker'
import { Icon } from '../../components/Icon'
import { Link, Progress, SimpleHeader } from '../../components/SiteChrome'
import { supabase } from '../../lib/supabase'

type PublicCaseOption = { public_slug: string, title: string | null, pet_name: string }
type SightingDraft = { selectedCase: string, location: { label: string, latitude: string, longitude: string, seenAt: string, details: string }, submissionToken: string }
const sightingDraftStorageKey = 'pet-seen:sighting-draft:v1'

function readSightingDraft(): SightingDraft | null {
  try {
    const stored = window.localStorage.getItem(sightingDraftStorageKey)
    if (!stored) return null
    const draft = JSON.parse(stored) as SightingDraft
    if (!draft?.location || typeof draft.submissionToken !== 'string') return null
    return draft
  } catch { return null }
}

export function SightingPage() {
  const { t } = useTranslation()
  const [cases, setCases] = useState<PublicCaseOption[]>([])
  const [selectedCase, setSelectedCase] = useState('')
  const [location, setLocation] = useState({ label: '', latitude: '', longitude: '', seenAt: new Date().toISOString().slice(0, 16), details: '' })
  const [state, setState] = useState<'idle' | 'saving' | 'success' | 'error' | 'offline'>('idle')
  const [error, setError] = useState('')
  const [draftRestored, setDraftRestored] = useState(false)
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const submissionToken = useRef<string>(crypto.randomUUID())
  const coordinates = location.latitude !== '' && location.longitude !== '' ? { latitude: Number(location.latitude), longitude: Number(location.longitude) } : null

  useEffect(() => {
    if (!supabase) return
    void supabase.from('public_missing_cases').select('public_slug,title,pet_name').order('published_at', { ascending: false }).limit(50).then(({ data }) => setCases((data ?? []) as PublicCaseOption[]))
  }, [])

  useEffect(() => {
    const draft = readSightingDraft()
    if (!draft) return
    setSelectedCase(draft.selectedCase); setLocation(draft.location); submissionToken.current = draft.submissionToken; setDraftRestored(true)
  }, [])

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline); window.addEventListener('offline', goOffline)
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline) }
  }, [])

  function saveDraft() { window.localStorage.setItem(sightingDraftStorageKey, JSON.stringify({ selectedCase, location, submissionToken: submissionToken.current } satisfies SightingDraft)) }

  function useCurrentLocation() {
    if (!navigator.geolocation) { setError(t('sighting.locationUnavailable')); return }
    setError('')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setLocation((current) => ({ ...current, latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) })),
      () => setError(t('sighting.locationDenied')),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 },
    )
  }

  async function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    const latitude = Number(location.latitude), longitude = Number(location.longitude)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) { setError(t('sighting.invalidLocation')); return }
    if (!supabase) { setError(t('sighting.unavailable')); return }
    if (!navigator.onLine) { saveDraft(); setState('offline'); return }
    setState('saving'); setError('')
    const { data: sightingId, error: submitError } = await supabase.rpc('submit_sighting', { selected_case_slug: selectedCase || null, latitude, longitude, sighted_at: new Date(location.seenAt).toISOString(), place_description: location.label, sighting_details: location.details, submission_token: submissionToken.current })
    if (submitError) { saveDraft(); setState('error'); setError(submitError.message || t('sighting.submitError')); return }
    if (selectedCase && sightingId) void supabase.functions.invoke('send-sighting-owner-email', { body: { sightingId } })
    window.localStorage.removeItem(sightingDraftStorageKey)
    setState('success')
  }

  if (state === 'success') return <div className="form-shell"><SimpleHeader /><main className="flow-layout"><section className="auth-card saved-pet" role="status"><Icon name="check-line" /><div><h1>{t('sighting.thanksTitle')}</h1><p>{t('sighting.thanksBody')}</p><Link className="primary-cta" to="/">{t('common.backToHome')}</Link></div></section></main></div>
  return <div className="form-shell"><SimpleHeader /><main className="flow-layout"><Progress label={t('sighting.progress')} total={2} /><section className="form-intro"><p className="eyebrow">{t('sighting.eyebrow')}</p><h1>{t('sighting.title')}</h1><p>{t('sighting.intro')}</p></section><form className="case-form sighting-form" onSubmit={(event) => void submit(event)}>{draftRestored && <p className="draft-notice" role="status"><Icon name="draft-line" />{t('sighting.draftRestored')}</p>}{!isOnline && <p className="draft-notice" role="status"><Icon name="wifi-off-line" />{t('sighting.offline')}</p>}<fieldset><legend>{t('sighting.petQuestion')}</legend><label>{t('sighting.petOrCase')}<select value={selectedCase} onChange={(event) => setSelectedCase(event.target.value)}><option value="">{t('sighting.unknownPet')}</option>{cases.map((caseData) => <option key={caseData.public_slug} value={caseData.public_slug}>{caseData.title || caseData.pet_name}</option>)}</select><small>{t('sighting.petHelp')}</small></label></fieldset><fieldset><legend>{t('sighting.whenWhere')}</legend><p className="location-help">{t('sighting.locationHelp')}</p><button className="secondary-button location-button" type="button" onClick={useCurrentLocation}><Icon name="navigation" />{t('sighting.useLocation')}</button>{error && <p className="location-error" role="alert">{error}</p>}<LocationPicker coordinates={coordinates} onChange={({ latitude, longitude }) => setLocation((current) => ({ ...current, latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) }))} /><p className="pin-note"><Icon name="map-pin-2" />{t('sighting.pinNote')}</p><label>{t('sighting.where')}<input value={location.label} maxLength={1500} onChange={(event) => setLocation({ ...location, label: event.target.value })} placeholder={t('sighting.whereHint')} /></label><div className="two-columns"><label>{t('sighting.latitude')}<input value={location.latitude} inputMode="decimal" onChange={(event) => setLocation({ ...location, latitude: event.target.value })} required /></label><label>{t('sighting.longitude')}<input value={location.longitude} inputMode="decimal" onChange={(event) => setLocation({ ...location, longitude: event.target.value })} required /></label></div><label>{t('sighting.when')}<input type="datetime-local" value={location.seenAt} onChange={(event) => setLocation({ ...location, seenAt: event.target.value })} required /></label></fieldset><fieldset><legend>{t('sighting.detailsQuestion')}</legend><label>{t('sighting.details')}<textarea value={location.details} maxLength={1500} onChange={(event) => setLocation({ ...location, details: event.target.value })} placeholder={t('sighting.detailsHint')} rows={4} required /></label></fieldset>{state === 'error' && <div className="submission-error" role="alert"><p>{error}</p><button className="secondary-button" type="button" onClick={() => void submit()}>{t('sighting.retry')}</button></div>}{state === 'offline' && <div className="submission-error" role="status"><p>{t('sighting.offlineSaved')}</p><button className="secondary-button" disabled={!isOnline} type="button" onClick={() => void submit()}>{t('sighting.retry')}</button></div>}<button className="primary-cta form-submit" disabled={state === 'saving'} type="submit">{state === 'saving' ? t('sighting.submitting') : t('common.submitSighting')} <Icon name="arrow-right" /></button><p className="form-privacy"><Icon name="shield-check" />{t('sighting.privacy')}</p></form></main></div>
}
