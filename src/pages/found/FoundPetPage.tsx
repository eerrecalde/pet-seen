import { useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '../../components/Icon'
import { LocationPicker } from '../../components/maps/LocationPicker'
import { PetPhotoUploadField } from '../../components/PetPhotoUploadField'
import { Link, Progress, SimpleHeader } from '../../components/SiteChrome'
import { usePetPhotoSelection } from '../../hooks/usePetPhotoSelection'
import { supabase } from '../../lib/supabase'

type CustodyStatus = 'with_reporter' | 'with_vet_or_rescue' | 'not_in_custody'

export function FoundPetPage() {
  const { t } = useTranslation()
  const [species, setSpecies] = useState<'dog' | 'cat'>('dog')
  const [custodyStatus, setCustodyStatus] = useState<CustodyStatus>('with_reporter')
  const [location, setLocation] = useState({ label: '', latitude: '', longitude: '', foundAt: new Date().toISOString().slice(0, 16) })
  const [state, setState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  const submissionToken = useRef(crypto.randomUUID())
  const { choosePhoto, photo, photoError } = usePetPhotoSelection({ invalidMessage: t('found.invalidPhoto'), prepareErrorMessage: t('found.preparePhotoError'), maxBytes: 5 * 1024 * 1024 })
  const coordinates = location.latitude !== '' && location.longitude !== '' ? { latitude: Number(location.latitude), longitude: Number(location.longitude) } : null

  function useCurrentLocation() {
    if (!navigator.geolocation) { setError(t('found.locationUnavailable')); return }
    setError('')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setLocation((current) => ({ ...current, latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) })),
      () => setError(t('found.locationDenied')),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 },
    )
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const latitude = Number(location.latitude), longitude = Number(location.longitude)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) { setError(t('found.invalidLocation')); return }
    if (!supabase) { setError(t('found.unavailable')); return }
    const fields = new FormData(event.currentTarget)
    setError(''); setState('saving')
    const { data: reportId, error: submitError } = await supabase.rpc('submit_found_pet_report', {
      found_species: species,
      found_breed: String(fields.get('breed') ?? ''),
      found_colour: String(fields.get('colour') ?? ''),
      found_details: String(fields.get('details') ?? ''),
      found_custody_status: custodyStatus,
      latitude,
      longitude,
      found_time: new Date(location.foundAt).toISOString(),
      place_description: location.label,
      custody_information: String(fields.get('custodyDetails') ?? ''),
      submission_token: submissionToken.current,
    })
    if (submitError || !reportId) { setState('error'); setError(submitError?.message || t('found.submitError')); return }
    if (photo) {
      const sourcePath = `source/${reportId}.jpg`
      const { error: uploadError } = await supabase.storage.from('found-pet-photos').upload(sourcePath, photo, { contentType: 'image/jpeg', upsert: false })
      if (uploadError) { setState('error'); setError(t('found.photoUploadError')); return }
      const { data: photoId, error: attachError } = await supabase.rpc('attach_found_pet_photo', { target_report_id: reportId, submission_token: submissionToken.current })
      if (attachError || !photoId) { setState('error'); setError(t('found.photoUploadError')); return }
      const { error: processError } = await supabase.functions.invoke('process-pet-photo', { body: { foundPhotoId: photoId } })
      if (processError) { setState('error'); setError(t('found.photoProcessError')); return }
    }
    setState('success')
  }

  if (state === 'success') return <div className="form-shell"><SimpleHeader /><main className="flow-layout"><section className="auth-card saved-pet" role="status"><Icon name="check-line" /><div><h1>{t('found.thanksTitle')}</h1><p>{t('found.thanksBody')}</p><p className="found-next-step"><Icon name="hospital" />{t('found.nextStep')}</p><Link className="primary-cta" to="/">{t('common.backToHome')}</Link></div></section></main></div>

  const requiresCustodyDetails = custodyStatus !== 'with_reporter'
  return <div className="form-shell"><SimpleHeader /><main className="flow-layout"><Progress label={t('found.progress')} total={2} /><section className="form-intro"><p className="eyebrow">{t('found.eyebrow')}</p><h1>{t('found.title')}</h1><p>{t('found.intro')}</p></section><form className="case-form found-form" onSubmit={(event) => void submit(event)}><fieldset><legend>{t('found.petDetails')}</legend><div className="choice-row" aria-label={t('found.species')}><button type="button" aria-pressed={species === 'dog'} className={`choice ${species === 'dog' ? 'selected' : ''}`} onClick={() => setSpecies('dog')}><span aria-hidden="true">🐶</span>{t('common.dog')}</button><button type="button" aria-pressed={species === 'cat'} className={`choice ${species === 'cat' ? 'selected' : ''}`} onClick={() => setSpecies('cat')}><span aria-hidden="true">🐱</span>{t('common.cat')}</button></div><div className="two-columns"><label>{t('found.breed')}<input name="breed" maxLength={120} placeholder={t('found.breedHint')} /></label><label>{t('found.markings')}<input name="colour" maxLength={120} placeholder={t('found.markingsHint')} /></label></div><label>{t('found.details')}<textarea name="details" maxLength={1500} placeholder={t('found.detailsHint')} rows={4} required /></label></fieldset><fieldset><legend>{t('found.photo')}</legend><PetPhotoUploadField accept="image/png,image/jpeg" addLabel={t('found.addPhoto')} error={photoError} hint={t('found.photoHint')} onChange={choosePhoto} photo={photo} /></fieldset><fieldset><legend>{t('found.custodyQuestion')}</legend><p className="field-help">{t('found.custodyHelp')}</p><div className="custody-options">{(['with_reporter', 'with_vet_or_rescue', 'not_in_custody'] as const).map((status) => <button key={status} className={`custody-option ${custodyStatus === status ? 'selected' : ''}`} type="button" aria-pressed={custodyStatus === status} onClick={() => setCustodyStatus(status)}><Icon name={status === 'with_reporter' ? 'home-heart' : status === 'with_vet_or_rescue' ? 'hospital' : 'footprint'} /><span>{t(`found.custody.${status}`)}</span></button>)}</div>{requiresCustodyDetails && <label className="custody-details">{t(`found.custodyDetails.${custodyStatus}.label`)}<textarea name="custodyDetails" maxLength={1500} placeholder={t(`found.custodyDetails.${custodyStatus}.hint`)} rows={3} /></label>}</fieldset><fieldset><legend>{t('found.whenWhere')}</legend><p className="location-help">{t('found.locationHelp')}</p><button className="secondary-button location-button" type="button" onClick={useCurrentLocation}><Icon name="navigation" />{t('found.useLocation')}</button>{error && <p className="location-error" role="alert">{error}</p>}<LocationPicker coordinates={coordinates} onChange={({ latitude, longitude }) => setLocation((current) => ({ ...current, latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) }))} /><p className="pin-note"><Icon name="map-pin-2" />{t('found.pinNote')}</p><label>{t('found.where')}<input value={location.label} maxLength={1500} onChange={(event) => setLocation((current) => ({ ...current, label: event.target.value }))} placeholder={t('found.whereHint')} /></label><label>{t('found.when')}<input type="datetime-local" value={location.foundAt} onChange={(event) => setLocation((current) => ({ ...current, foundAt: event.target.value }))} required /></label></fieldset>{state === 'error' && <div className="submission-error" role="alert"><p>{error}</p></div>}<button className="primary-cta form-submit" disabled={state === 'saving'} type="submit">{state === 'saving' ? t('found.submitting') : t('found.submit')} <Icon name="arrow-right" /></button><p className="form-privacy"><Icon name="shield-check" />{t('found.privacy')}</p></form></main></div>
}
