import { useReducer, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '../../components/Icon'
import { LocationPicker } from '../../components/maps/LocationPicker'
import { LocationSearch } from '../../components/maps/LocationSearch'
import { PetPhotoUploadField } from '../../components/PetPhotoUploadField'
import { PetAttributeSuggestions } from '../../components/PetAttributeSuggestions'
import { Link, Progress, SimpleHeader } from '../../components/SiteChrome'
import { usePetPhotoSelection } from '../../hooks/usePetPhotoSelection'
import { photoPayload } from '../../lib/photo-payload'
import { supabase } from '../../lib/supabase'
import { getCurrentCoordinates } from '../../lib/geolocation'
import {
  foundPetWorkflowReducer,
  initialFoundPetWorkflow,
} from '../../features/found-pet/workflow'

type CustodyStatus = 'with_reporter' | 'with_vet_or_rescue' | 'not_in_custody'

type FoundPetLocation = {
  label: string
  latitude: string
  longitude: string
  foundAt: string
}

export function FoundPetPage() {
  const { t } = useTranslation()
  const [species, setSpecies] = useState<'dog' | 'cat'>('dog')
  const [custodyStatus, setCustodyStatus] =
    useState<CustodyStatus>('with_reporter')
  const [location, setLocation] = useState<FoundPetLocation>({
    label: '',
    latitude: '',
    longitude: '',
    foundAt: new Date().toISOString().slice(0, 16),
  })
  const [workflow, dispatch] = useReducer(
    foundPetWorkflowReducer,
    initialFoundPetWorkflow,
  )
  const [followUpEmail, setFollowUpEmail] = useState('')
  const submissionToken = useRef(crypto.randomUUID())
  const { choosePhoto, photo, photoError } = usePetPhotoSelection({
    invalidMessage: t('found.invalidPhoto'),
    prepareErrorMessage: t('found.preparePhotoError'),
    maxBytes: 5 * 1024 * 1024,
  })
  const coordinates =
    location.latitude !== '' && location.longitude !== ''
      ? {
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
        }
      : null

  async function useCurrentLocation() {
    dispatch({ type: 'clear_error' })
    const result = await getCurrentCoordinates({
      enableHighAccuracy: false,
      maximumAge: 60_000,
      timeout: 15_000,
    })
    if (!result.ok) {
      dispatch({
        type: 'validation_failed',
        error: t(
          result.reason === 'unavailable'
            ? 'found.locationUnavailable'
            : 'found.locationDenied',
        ),
      })
      return
    }
    setLocation((current) => ({
      ...current,
      latitude: result.coordinates.latitude.toFixed(6),
      longitude: result.coordinates.longitude.toFixed(6),
    }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const latitude = Number(location.latitude)
    const longitude = Number(location.longitude)
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      dispatch({ type: 'validation_failed', error: t('found.invalidLocation') })
      return
    }
    if (!supabase) {
      dispatch({ type: 'validation_failed', error: t('found.unavailable') })
      return
    }
    const fields = new FormData(event.currentTarget)
    dispatch({ type: 'start_submission' })
    const payload = {
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
      follow_up_email: followUpEmail.trim() || null,
    }
    const { error: submitError } = await supabase.functions.invoke(
      'submit-workflow',
      { body: { kind: 'found', payload, photo: await photoPayload(photo) } },
    )
    if (submitError) {
      dispatch({
        type: 'submission_failed',
        error: submitError.message || t('found.submitError'),
      })
      return
    }
    if (followUpEmail.trim()) {
      await supabase.auth.signInWithOtp({
        email: followUpEmail.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/found/follow-up`,
        },
      })
    }
    dispatch({ type: 'submission_succeeded' })
  }

  if (workflow.submission === 'success') {
    return (
      <div className="form-shell">
        <SimpleHeader />
        <main className="flow-layout">
          <section className="auth-card saved-pet" role="status">
            <Icon name="check-line" />
            <div>
              <h1>{t('found.thanksTitle')}</h1>
              <p>{t('found.thanksBody')}</p>
              {followUpEmail && (
                <p>{t('found.followUpSent', { email: followUpEmail })}</p>
              )}
              <p className="found-next-step">
                <Icon name="hospital" />
                {t('found.nextStep')}
              </p>
              <Link className="primary-cta" to="/">
                {t('common.backToHome')}
              </Link>
            </div>
          </section>
        </main>
      </div>
    )
  }

  const requiresCustodyDetails = custodyStatus !== 'with_reporter'
  return (
    <div className="form-shell">
      <SimpleHeader />
      <main className="flow-layout">
        <Progress label={t('found.progress')} total={2} />
        <section className="form-intro">
          <p className="eyebrow">{t('found.eyebrow')}</p>
          <h1>{t('found.title')}</h1>
          <p>{t('found.intro')}</p>
        </section>
        <form
          className="case-form found-form"
          onSubmit={(event) => void submit(event)}
        >
          <fieldset>
            <legend>{t('found.petDetails')}</legend>
            <div className="choice-row" aria-label={t('found.species')}>
              <button
                type="button"
                aria-pressed={species === 'dog'}
                className={`choice ${species === 'dog' ? 'selected' : ''}`}
                onClick={() => setSpecies('dog')}
              >
                <span aria-hidden="true">🐶</span>
                {t('common.dog')}
              </button>
              <button
                type="button"
                aria-pressed={species === 'cat'}
                className={`choice ${species === 'cat' ? 'selected' : ''}`}
                onClick={() => setSpecies('cat')}
              >
                <span aria-hidden="true">🐱</span>
                {t('common.cat')}
              </button>
            </div>
            <PetAttributeSuggestions id="found-pet" species={species} />
            <div className="two-columns">
              <label>
                {t('found.breed')}
                <input
                  name="breed"
                  list="found-pet-breed"
                  maxLength={120}
                  placeholder={t('found.breedHint')}
                />
              </label>
              <label>
                {t('found.markings')}
                <input
                  name="colour"
                  list="found-pet-colour"
                  maxLength={120}
                  placeholder={t('found.markingsHint')}
                />
              </label>
            </div>
            <label>
              {t('found.details')}
              <textarea
                name="details"
                maxLength={1500}
                placeholder={t('found.detailsHint')}
                rows={4}
                required
              />
            </label>
          </fieldset>
          <fieldset>
            <legend>{t('found.photo')}</legend>
            <PetPhotoUploadField
              accept="image/png,image/jpeg"
              addLabel={t('found.addPhoto')}
              error={photoError}
              hint={t('found.photoHint')}
              onChange={choosePhoto}
              photo={photo}
            />
          </fieldset>
          <fieldset>
            <legend>{t('found.custodyQuestion')}</legend>
            <p className="field-help">{t('found.custodyHelp')}</p>
            <div className="custody-options">
              {(
                [
                  'with_reporter',
                  'with_vet_or_rescue',
                  'not_in_custody',
                ] as const
              ).map((status) => (
                <button
                  key={status}
                  className={`custody-option ${custodyStatus === status ? 'selected' : ''}`}
                  type="button"
                  aria-pressed={custodyStatus === status}
                  onClick={() => setCustodyStatus(status)}
                >
                  <Icon
                    name={
                      status === 'with_reporter'
                        ? 'home-heart'
                        : status === 'with_vet_or_rescue'
                          ? 'hospital'
                          : 'footprint'
                    }
                  />
                  <span>{t(`found.custody.${status}`)}</span>
                </button>
              ))}
            </div>
            {requiresCustodyDetails && (
              <label className="custody-details">
                {t(`found.custodyDetails.${custodyStatus}.label`)}
                <textarea
                  name="custodyDetails"
                  maxLength={1500}
                  placeholder={t(`found.custodyDetails.${custodyStatus}.hint`)}
                  rows={3}
                />
              </label>
            )}
          </fieldset>
          <fieldset>
            <legend>{t('found.followUpTitle')}</legend>
            <p className="field-help">{t('found.followUpHelp')}</p>
            <label>
              {t('found.followUpEmail')}
              <input
                autoComplete="email"
                inputMode="email"
                maxLength={254}
                onChange={(event) => setFollowUpEmail(event.target.value)}
                placeholder={t('found.followUpEmailHint')}
                type="email"
                value={followUpEmail}
              />
            </label>
          </fieldset>
          <fieldset>
            <legend>{t('found.whenWhere')}</legend>
            <p className="location-help">{t('found.locationHelp')}</p>
            <button
              className="secondary-button location-button"
              type="button"
              onClick={useCurrentLocation}
            >
              <Icon name="navigation" />
              {t('found.useLocation')}
            </button>
            <LocationSearch
              onSelect={({ label, latitude, longitude }) =>
                setLocation((current) => ({
                  ...current,
                  label,
                  latitude: latitude.toFixed(6),
                  longitude: longitude.toFixed(6),
                }))
              }
              strings={{
                label: t('found.searchLocation'),
                placeholder: t('found.searchLocationHint'),
                search: t('found.search'),
                searching: t('found.searching'),
                noResults: t('found.searchNoResults'),
                error: t('found.searchError'),
              }}
            />
            {workflow.error && (
              <p className="location-error" role="alert">
                {workflow.error}
              </p>
            )}
            <LocationPicker
              coordinates={coordinates}
              onChange={({ latitude, longitude }) =>
                setLocation((current) => ({
                  ...current,
                  latitude: latitude.toFixed(6),
                  longitude: longitude.toFixed(6),
                }))
              }
            />
            <p className="pin-note">
              <Icon name="map-pin-2" />
              {coordinates ? t('found.pinConfirmed') : t('found.pinNote')}
            </p>
            <label>
              {t('found.where')}
              <input
                value={location.label}
                maxLength={1500}
                onChange={(event) =>
                  setLocation((current) => ({
                    ...current,
                    label: event.target.value,
                  }))
                }
                placeholder={t('found.whereHint')}
              />
            </label>
            <label>
              {t('found.when')}
              <input
                type="datetime-local"
                value={location.foundAt}
                onChange={(event) =>
                  setLocation((current) => ({
                    ...current,
                    foundAt: event.target.value,
                  }))
                }
                required
              />
            </label>
          </fieldset>
          {workflow.submission === 'error' && (
            <div className="submission-error" role="alert">
              <p>{workflow.error}</p>
            </div>
          )}
          <button
            className="primary-cta form-submit"
            disabled={workflow.submission === 'saving'}
            type="submit"
          >
            {workflow.submission === 'saving'
              ? t('found.submitting')
              : t('found.submit')}{' '}
            <Icon name="arrow-right" />
          </button>
          <p className="form-privacy">
            <Icon name="shield-check" />
            {t('found.privacy')}
          </p>
        </form>
      </main>
    </div>
  )
}
