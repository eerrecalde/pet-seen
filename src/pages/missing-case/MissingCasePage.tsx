import { useCallback, useReducer, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { LocationPicker } from '../../components/maps/LocationPicker'
import { useAuth } from '../../auth/useAuth'
import { Icon } from '../../components/Icon'
import { PetPhotoUploadField } from '../../components/PetPhotoUploadField'
import { Link, Progress, SimpleHeader } from '../../components/SiteChrome'
import { usePetPhotoSelection } from '../../hooks/usePetPhotoSelection'
import { supabase } from '../../lib/supabase'
import { photoPayload } from '../../lib/photo-payload'
import { initialMissingCaseWorkflow, missingCaseWorkflowReducer } from '../../features/missing-case/workflow'

export function MissingCasePage() {
  const { t } = useTranslation()
  const { session, isLoading } = useAuth()
  const [workflow, dispatch] = useReducer(missingCaseWorkflowReducer, initialMissingCaseWorkflow)
  const [species, setSpecies] = useState<'dog' | 'cat'>('dog')
  const [draft, setDraft] = useState<{ id: string, petId: string, petName: string } | null>(null)
  const [location, setLocation] = useState({ label: '', latitude: '', longitude: '', seenAt: new Date().toISOString().slice(0, 16) })
  const discardOnExit = useRef(true)
  const { choosePhoto, photo, photoError } = usePetPhotoSelection({ invalidMessage: t('missingCase.invalidPhoto'), prepareErrorMessage: t('missingCase.preparePhotoError') })

  async function savePet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !session) return
    const fields = new FormData(event.currentTarget)
    const petName = String(fields.get('name') ?? '').trim()
    dispatch({ type: 'start_submission' })
    const { data, error: saveError } = await supabase.functions.invoke<{ id: string, petId: string }>('submit-workflow', { body: { kind: 'missing_case_draft', payload: { pet_name: petName, pet_species: species, pet_breed: String(fields.get('breed') ?? ''), pet_colour: String(fields.get('colour') ?? ''), pet_description: String(fields.get('description') ?? '') }, photo: await photoPayload(photo) } })
    if (saveError || !data) { dispatch({ type: 'failed', error: saveError?.message ?? t('missingCase.saveError') }); return }
    setDraft({ id: data.id, petId: data.petId, petName }); dispatch({ type: 'draft_saved' })
  }

  const discardDraft = useCallback(async (caseDraft: { id: string, petId: string } | null = draft) => {
    if (!supabase || !session || !caseDraft) return true
    const { error } = await supabase.functions.invoke('submit-workflow', { body: { kind: 'missing_case_discard', caseId: caseDraft.id } })
    if (error) { dispatch({ type: 'failed', error: error.message }); return false }
    return true
  }, [draft, session])

  async function exitFlow() {
    dispatch({ type: 'start_submission' })
    const discarded = await discardDraft()
    if (!discarded) return false
    discardOnExit.current = false
    return true
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) { dispatch({ type: 'validation_failed', error: 'Your browser cannot provide a location. Move the pin on the map to set the last-seen location.' }); return }
    dispatch({ type: 'clear_error' })
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setLocation((current) => ({ ...current, latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) })),
      () => dispatch({ type: 'validation_failed', error: 'We could not access your location. Allow location access in your browser, then try again, or move the pin on the map.' }),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 },
    )
  }

  async function saveLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !session || !draft) return
    const latitude = Number(location.latitude), longitude = Number(location.longitude)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) { dispatch({ type: 'validation_failed', error: 'Enter a valid latitude and longitude.' }); return }
    dispatch({ type: 'start_submission' })
    const { error: updateError } = await supabase.from('missing_cases').update({ exact_location: `POINT(${longitude} ${latitude})`, last_seen_at: new Date(location.seenAt).toISOString(), last_seen_description: location.label.trim() || null, status: 'published', published_at: new Date().toISOString() }).eq('id', draft.id).eq('owner_id', session.user.id)
    if (updateError) { dispatch({ type: 'failed', error: updateError.message }); return }
    discardOnExit.current = false
    dispatch({ type: 'published' })
  }

  const current = workflow.stage === 'details' ? 1 : 2
  const selectedCoordinates = location.latitude !== '' && location.longitude !== '' ? { latitude: Number(location.latitude), longitude: Number(location.longitude) } : null
  return <div className="form-shell"><SimpleHeader onExit={exitFlow} /><main className="flow-layout">
    <Progress label={t('missingCase.progress')} total={2} current={current} />
    <section className="form-intro"><p className="eyebrow">{t('missingCase.eyebrow')}</p><h1>{workflow.stage === 'location' ? `Where was ${draft?.petName} last seen?` : workflow.stage === 'published' ? 'Your case is live.' : t('missingCase.title')}</h1><p>{workflow.stage === 'location' ? 'Use your current location or move the pin on the map. Only an approximate area is public.' : workflow.stage === 'published' ? 'You can now share the case with people nearby.' : t('missingCase.intro')}</p></section>
    {isLoading ? <p>{t('auth.loading')}</p> : !session ? <section className="auth-card sign-in-required"><h2>{t('missingCase.signInTitle')}</h2><p>{t('missingCase.signInBody')}</p><Link className="primary-cta" to="/auth">{t('common.signIn')}<Icon name="arrow-right" /></Link></section> : workflow.stage === 'published' ? <section className="auth-card saved-pet" role="status"><Icon name="check-line" /><div><h2>Case published.</h2><p>Share the link with people nearby. The public page shows only an approximate area.</p><Link className="primary-cta" to="/">{t('common.backToHome')}</Link></div></section> : workflow.stage === 'location' ? <form className="case-form" onSubmit={(event) => void saveLocation(event)}><fieldset><legend>{t('missingCase.lastSeenQuestion', { petName: draft?.petName ?? '' })}</legend><p className="location-help">Use your current location or move the pin on the map.</p><button className="secondary-button location-button" type="button" onClick={useCurrentLocation}><Icon name="navigation" />Use my location</button>{workflow.error && <p className="location-error" role="alert">{workflow.error}</p>}<LocationPicker coordinates={selectedCoordinates} onChange={({ latitude, longitude }) => setLocation({ ...location, latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) })} /><p className="pin-note"><Icon name="map-pin-2" />Move the pin or tap the map to set the last-seen location before continuing.</p><label>Place or landmark<input value={location.label} maxLength={1500} onChange={(event) => setLocation({ ...location, label: event.target.value })} placeholder="For example, the south gate of Victoria Park" /></label><label>{t('missingCase.lastSeen')}<input type="datetime-local" value={location.seenAt} onChange={(event) => setLocation({ ...location, seenAt: event.target.value })} required /></label></fieldset><p className="form-privacy"><Icon name="shield-check" />{t('missingCase.exactLocationNote')}</p>{workflow.error && <p className="form-error" role="alert">{workflow.error}</p>}<button className="primary-cta form-submit" disabled={workflow.submission === 'saving'} type="submit">{workflow.submission === 'saving' ? 'Publishing…' : 'Save and publish case'}<Icon name="arrow-right" /></button></form> : <form className="case-form" onSubmit={(event) => void savePet(event)}><fieldset><legend>{t('missingCase.details')}</legend><div className="choice-row" aria-label={t('missingCase.species')}><button type="button" aria-pressed={species === 'dog'} className={`choice ${species === 'dog' ? 'selected' : ''}`} onClick={() => setSpecies('dog')}><span aria-hidden="true">🐶</span>{t('common.dog')}</button><button type="button" aria-pressed={species === 'cat'} className={`choice ${species === 'cat' ? 'selected' : ''}`} onClick={() => setSpecies('cat')}><span aria-hidden="true">🐱</span>{t('common.cat')}</button></div><label>{t('missingCase.petName')}<input name="name" maxLength={80} required /></label><div className="two-columns"><label>{t('missingCase.breed')}<input name="breed" maxLength={120} placeholder={t('missingCase.breedHint')} /></label><label>{t('missingCase.markings')}<input name="colour" maxLength={120} placeholder={t('missingCase.markingsHint')} /></label></div><label>{t('missingCase.description')}<textarea name="description" maxLength={1500} placeholder={t('missingCase.descriptionHint')} rows={4} /></label></fieldset><fieldset><legend>{t('missingCase.photo')}</legend><PetPhotoUploadField accept="image/png,image/jpeg" addLabel={t('missingCase.addPhoto')} error={photoError} hint={t('missingCase.photoHint')} onChange={choosePhoto} photo={photo} /></fieldset>{workflow.submission === 'error' && <p className="form-error" role="alert">{workflow.error}</p>}<button className="primary-cta form-submit" disabled={workflow.submission === 'saving'} type="submit"><span>{workflow.submission === 'saving' ? t('missingCase.saving') : t('common.continue')}</span><Icon name="arrow-right" /></button></form>}
  </main></div>
}
