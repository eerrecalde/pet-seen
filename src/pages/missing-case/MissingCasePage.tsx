import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { LocationPicker } from '../../components/maps/LocationPicker'
import { useAuth } from '../../auth/useAuth'
import { Icon } from '../../components/Icon'
import { PetPhotoUploadField } from '../../components/PetPhotoUploadField'
import { Link, Progress, SimpleHeader } from '../../components/SiteChrome'
import { usePetPhotoSelection } from '../../hooks/usePetPhotoSelection'
import { supabase } from '../../lib/supabase'

export function MissingCasePage() {
  const { t } = useTranslation()
  const { session, isLoading } = useAuth()
  const [stage, setStage] = useState<'details' | 'location' | 'published'>('details')
  const [species, setSpecies] = useState<'dog' | 'cat'>('dog')
  const [draft, setDraft] = useState<{ id: string, petId: string, petName: string } | null>(null)
  const [location, setLocation] = useState({ label: '', latitude: '', longitude: '', seenAt: new Date().toISOString().slice(0, 16) })
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle')
  const [error, setError] = useState('')
  const discardOnExit = useRef(true)
  const { choosePhoto, photo, photoError } = usePetPhotoSelection({ invalidMessage: t('missingCase.invalidPhoto'), prepareErrorMessage: t('missingCase.preparePhotoError') })

  async function savePet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !session) return
    const client = supabase
    const userId = session.user.id
    const fields = new FormData(event.currentTarget)
    const petName = String(fields.get('name') ?? '').trim()
    setError(''); setState('saving')
    const { data: pet, error: petError } = await client.from('pets').insert({ owner_id: userId, name: petName, species, breed: String(fields.get('breed') ?? '').trim() || null, colour: String(fields.get('colour') ?? '').trim() || null, description: String(fields.get('description') ?? '').trim() || null }).select('id').single()
    if (petError || !pet) { setError(petError?.message ?? t('missingCase.saveError')); setState('error'); return }
    const petId = pet.id
    async function discardPetAfterPhotoFailure(sourceObjectPath?: string, photoId?: string) {
      if (photoId) await client.from('pet_photos').delete().eq('id', photoId).eq('owner_id', userId)
      if (sourceObjectPath) await client.storage.from('pet-photos').remove([sourceObjectPath])
      await client.from('pets').delete().eq('id', petId).eq('owner_id', userId)
    }
    if (photo) {
      const sourceObjectPath = `${userId}/source/${crypto.randomUUID()}.jpg`
      const { error: uploadError } = await client.storage.from('pet-photos').upload(sourceObjectPath, photo, { contentType: photo.type, upsert: false })
      if (uploadError) { await discardPetAfterPhotoFailure(); setError(uploadError.message); setState('error'); return }
      const { data: photoRecord, error: photoInsertError } = await client.from('pet_photos').insert({ pet_id: petId, owner_id: userId, source_object_path: sourceObjectPath }).select('id').single()
      if (photoInsertError || !photoRecord) { await discardPetAfterPhotoFailure(sourceObjectPath); setError(photoInsertError?.message ?? t('missingCase.photoProcessError')); setState('error'); return }
      const { error: processError } = await client.functions.invoke('process-pet-photo', { body: { photoId: photoRecord.id } })
      if (processError) { await discardPetAfterPhotoFailure(sourceObjectPath, photoRecord.id); setError(t('missingCase.photoProcessError')); setState('error'); return }
    }
    const { data: caseDraft, error: caseError } = await client.from('missing_cases').insert({ owner_id: session.user.id, pet_id: pet.id, status: 'draft', title: `${petName} is missing` }).select('id').single()
    if (caseError || !caseDraft) { setError(caseError?.message ?? t('missingCase.saveError')); setState('error'); return }
    setDraft({ id: caseDraft.id, petId: pet.id, petName }); setState('idle'); setStage('location')
  }

  const discardDraft = useCallback(async (caseDraft: { id: string, petId: string } | null = draft) => {
    if (!supabase || !session || !caseDraft) return true

    const { data: photos, error: photosError } = await supabase.from('pet_photos').select('source_object_path,display_object_path').eq('pet_id', caseDraft.petId).eq('owner_id', session.user.id)
    if (photosError) { setError(photosError.message); setState('error'); return false }

    const { error: caseError } = await supabase.from('missing_cases').delete().eq('id', caseDraft.id).eq('owner_id', session.user.id)
    if (caseError) { setError(caseError.message); setState('error'); return false }

    const { error: petError } = await supabase.from('pets').delete().eq('id', caseDraft.petId).eq('owner_id', session.user.id)
    if (petError) { setError(petError.message); setState('error'); return false }

    const photoPaths = (photos ?? []).flatMap((photo) => [photo.source_object_path, photo.display_object_path].filter((path): path is string => Boolean(path)))
    if (photoPaths.length > 0) {
      const { error: storageError } = await supabase.storage.from('pet-photos').remove(photoPaths)
      if (storageError) console.error('Could not remove discarded pet photo files', storageError)
    }
    return true
  }, [draft, session])

  async function exitFlow() {
    setError(''); setState('saving')
    const discarded = await discardDraft()
    if (!discarded) return false
    discardOnExit.current = false
    return true
  }

  useEffect(() => {
    if (!draft) return
    return () => {
      if (discardOnExit.current) void discardDraft(draft)
    }
  }, [discardDraft, draft])

  function useCurrentLocation() {
    if (!navigator.geolocation) { setError('Your browser cannot provide a location. Move the pin on the map to set the last-seen location.'); return }
    setError('')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setLocation((current) => ({ ...current, latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) })),
      () => setError('We could not access your location. Allow location access in your browser, then try again, or move the pin on the map.'),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 },
    )
  }

  async function saveLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !session || !draft) return
    const latitude = Number(location.latitude), longitude = Number(location.longitude)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) { setError('Enter a valid latitude and longitude.'); return }
    setError(''); setState('saving')
    const { error: updateError } = await supabase.from('missing_cases').update({ exact_location: `POINT(${longitude} ${latitude})`, last_seen_at: new Date(location.seenAt).toISOString(), last_seen_description: location.label.trim() || null, status: 'published', published_at: new Date().toISOString() }).eq('id', draft.id).eq('owner_id', session.user.id)
    if (updateError) { setError(updateError.message); setState('error'); return }
    discardOnExit.current = false
    setState('idle'); setStage('published')
  }

  const current = stage === 'details' ? 1 : 2
  const selectedCoordinates = location.latitude !== '' && location.longitude !== '' ? { latitude: Number(location.latitude), longitude: Number(location.longitude) } : null
  return <div className="form-shell"><SimpleHeader onExit={exitFlow} /><main className="flow-layout">
    <Progress label={t('missingCase.progress')} total={2} current={current} />
    <section className="form-intro"><p className="eyebrow">{t('missingCase.eyebrow')}</p><h1>{stage === 'location' ? `Where was ${draft?.petName} last seen?` : stage === 'published' ? 'Your case is live.' : t('missingCase.title')}</h1><p>{stage === 'location' ? 'Use your current location or move the pin on the map. Only an approximate area is public.' : stage === 'published' ? 'You can now share the case with people nearby.' : t('missingCase.intro')}</p></section>
    {isLoading ? <p>{t('auth.loading')}</p> : !session ? <section className="auth-card sign-in-required"><h2>{t('missingCase.signInTitle')}</h2><p>{t('missingCase.signInBody')}</p><Link className="primary-cta" to="/auth">{t('common.signIn')}<Icon name="arrow-right" /></Link></section> : stage === 'published' ? <section className="auth-card saved-pet" role="status"><Icon name="check-line" /><div><h2>Case published.</h2><p>Share the link with people nearby. The public page shows only an approximate area.</p><Link className="primary-cta" to="/">{t('common.backToHome')}</Link></div></section> : stage === 'location' ? <form className="case-form" onSubmit={(event) => void saveLocation(event)}><fieldset><legend>{t('missingCase.lastSeenQuestion', { petName: draft?.petName ?? '' })}</legend><p className="location-help">Use your current location or move the pin on the map.</p><button className="secondary-button location-button" type="button" onClick={useCurrentLocation}><Icon name="navigation" />Use my location</button>{error && <p className="location-error" role="alert">{error}</p>}<LocationPicker coordinates={selectedCoordinates} onChange={({ latitude, longitude }) => setLocation({ ...location, latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) })} /><p className="pin-note"><Icon name="map-pin-2" />Move the pin or tap the map to set the last-seen location before continuing.</p><label>Place or landmark<input value={location.label} maxLength={1500} onChange={(event) => setLocation({ ...location, label: event.target.value })} placeholder="For example, the south gate of Victoria Park" /></label><label>{t('missingCase.lastSeen')}<input type="datetime-local" value={location.seenAt} onChange={(event) => setLocation({ ...location, seenAt: event.target.value })} required /></label></fieldset><p className="form-privacy"><Icon name="shield-check" />{t('missingCase.exactLocationNote')}</p>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-cta form-submit" disabled={state === 'saving'} type="submit">{state === 'saving' ? 'Publishing…' : 'Save and publish case'}<Icon name="arrow-right" /></button></form> : <form className="case-form" onSubmit={(event) => void savePet(event)}><fieldset><legend>{t('missingCase.details')}</legend><div className="choice-row" aria-label={t('missingCase.species')}><button type="button" aria-pressed={species === 'dog'} className={`choice ${species === 'dog' ? 'selected' : ''}`} onClick={() => setSpecies('dog')}><span aria-hidden="true">🐶</span>{t('common.dog')}</button><button type="button" aria-pressed={species === 'cat'} className={`choice ${species === 'cat' ? 'selected' : ''}`} onClick={() => setSpecies('cat')}><span aria-hidden="true">🐱</span>{t('common.cat')}</button></div><label>{t('missingCase.petName')}<input name="name" maxLength={80} required /></label><div className="two-columns"><label>{t('missingCase.breed')}<input name="breed" maxLength={120} placeholder={t('missingCase.breedHint')} /></label><label>{t('missingCase.markings')}<input name="colour" maxLength={120} placeholder={t('missingCase.markingsHint')} /></label></div><label>{t('missingCase.description')}<textarea name="description" maxLength={1500} placeholder={t('missingCase.descriptionHint')} rows={4} /></label></fieldset><fieldset><legend>{t('missingCase.photo')}</legend><PetPhotoUploadField accept="image/png,image/jpeg" addLabel={t('missingCase.addPhoto')} error={photoError} hint={t('missingCase.photoHint')} onChange={choosePhoto} photo={photo} /></fieldset>{state === 'error' && <p className="form-error" role="alert">{error}</p>}<button className="primary-cta form-submit" disabled={state === 'saving'} type="submit"><span>{state === 'saving' ? t('missingCase.saving') : t('common.continue')}</span><Icon name="arrow-right" /></button></form>}
  </main></div>
}
