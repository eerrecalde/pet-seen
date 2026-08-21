import { useEffect, useReducer, useRef, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '../../components/Icon'
import { LocationPicker } from '../../components/maps/LocationPicker'
import { PetImage } from '../../components/PetImage'
import { Link, Progress, SimpleHeader } from '../../components/SiteChrome'
import { usePublicCaseOptionsQuery } from '../../features/public-cases/queries'
import type { PublicCaseOption } from '../../features/public-cases/types'
import { supabase } from '../../lib/supabase'
import { createInitialSightingWorkflow, sightingWorkflowReducer, type SightingDraft } from '../../features/sighting/workflow'

const sightingDraftStorageKey = 'pet-seen:sighting-draft:v1'

function readSightingDraft(): SightingDraft | null {
  try {
    const stored = window.localStorage.getItem(sightingDraftStorageKey)
    if (!stored) return null
    const draft = JSON.parse(stored) as SightingDraft
    return draft?.location && typeof draft.submissionToken === 'string' ? draft : null
  } catch { return null }
}

export function SightingPage() {
  const { t } = useTranslation()
  const { data: cases = [], isError: isCaseOptionsError, isPending: isCaseOptionsPending } = usePublicCaseOptionsQuery()
  const [workflow, dispatch] = useReducer(sightingWorkflowReducer, undefined, () => createInitialSightingWorkflow({ label: '', latitude: '', longitude: '', seenAt: new Date().toISOString().slice(0, 16), details: '' }, navigator.onLine))
  const submissionToken = useRef<string>(crypto.randomUUID())
  const coordinates = workflow.location.latitude !== '' && workflow.location.longitude !== '' ? { latitude: Number(workflow.location.latitude), longitude: Number(workflow.location.longitude) } : null
  const selectedCaseData = cases.find((caseData) => caseData.public_slug === workflow.selectedCase)

  useEffect(() => {
    const draft = readSightingDraft()
    if (!draft) return
    dispatch({ type: 'restore_draft', draft }); submissionToken.current = draft.submissionToken
  }, [])

  useEffect(() => {
    const goOnline = () => dispatch({ type: 'set_online', isOnline: true })
    const goOffline = () => dispatch({ type: 'set_online', isOnline: false })
    window.addEventListener('online', goOnline); window.addEventListener('offline', goOffline)
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline) }
  }, [])

  function saveDraft() { window.localStorage.setItem(sightingDraftStorageKey, JSON.stringify({ selectedCase: workflow.selectedCase, location: workflow.location, submissionToken: submissionToken.current } satisfies SightingDraft)) }
  function chooseCase(caseSlug: string) { dispatch({ type: 'choose_case', caseSlug }) }

  function useCurrentLocation() {
    if (!navigator.geolocation) { dispatch({ type: 'validation_failed', error: t('sighting.locationUnavailable') }); return }
    dispatch({ type: 'clear_error' })
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => dispatch({ type: 'update_location', location: { ...workflow.location, latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) } }),
      () => dispatch({ type: 'validation_failed', error: t('sighting.locationDenied') }),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 },
    )
  }

  async function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    const latitude = Number(workflow.location.latitude), longitude = Number(workflow.location.longitude)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) { dispatch({ type: 'validation_failed', error: t('sighting.invalidLocation') }); return }
    if (!supabase) { dispatch({ type: 'validation_failed', error: t('sighting.unavailable') }); return }
    dispatch({ type: 'start_submission' })
    const { error: submitError } = await supabase.functions.invoke('submit-workflow', { body: { kind: 'sighting', payload: { selected_case_slug: workflow.selectedCase || null, latitude, longitude, sighted_at: new Date(workflow.location.seenAt).toISOString(), place_description: workflow.location.label, sighting_details: workflow.location.details, submission_token: submissionToken.current } } })
    if (submitError) {
      saveDraft()
      if (!navigator.onLine) { dispatch({ type: 'submission_saved_offline' }); return }
      dispatch({ type: 'submission_failed', error: submitError.message || t('sighting.submitError') }); return
    }
    window.localStorage.removeItem(sightingDraftStorageKey)
    dispatch({ type: 'submission_succeeded' })
  }

  if (workflow.submission === 'success') return <div className="form-shell"><SimpleHeader /><main className="flow-layout"><section className="auth-card saved-pet" role="status"><Icon name="check-line" /><div><h1>{t('sighting.thanksTitle')}</h1><p>{t('sighting.thanksBody')}</p><Link className="primary-cta" to="/">{t('common.backToHome')}</Link></div></section></main></div>

  return <div className="form-shell"><SimpleHeader /><main className="flow-layout"><Progress label={t('sighting.progress')} total={2} /><section className="form-intro"><p className="eyebrow">{t('sighting.eyebrow')}</p><h1>{t('sighting.title')}</h1><p>{t('sighting.intro')}</p></section><form className="case-form sighting-form" onSubmit={(event) => void submit(event)}>{workflow.draftRestored && <p className="draft-notice" role="status"><Icon name="draft-line" />{t('sighting.draftRestored')}</p>}{!workflow.isOnline && <p className="draft-notice" role="status"><Icon name="wifi-off-line" />{t('sighting.offline')}</p>}<fieldset><legend>{t('sighting.petQuestion')}</legend>{selectedCaseData ? <SelectedCase caseData={selectedCaseData} onChange={() => dispatch({ type: 'open_case_picker' })} onRemove={() => dispatch({ type: 'clear_case' })} /> : <><p className="pet-picker-help">{t('sighting.petHelp')}</p><button className="secondary-button choose-pet-button" type="button" onClick={() => dispatch({ type: 'open_case_picker' })}><Icon name="search-eye" />{t('sighting.choosePet')}</button></>}</fieldset><fieldset><legend>{t('sighting.whenWhere')}</legend><p className="location-help">{t('sighting.locationHelp')}</p><button className="secondary-button location-button" type="button" onClick={useCurrentLocation}><Icon name="navigation" />{t('sighting.useLocation')}</button>{workflow.error && <p className="location-error" role="alert">{workflow.error}</p>}<LocationPicker coordinates={coordinates} onChange={({ latitude, longitude }) => dispatch({ type: 'update_location', location: { ...workflow.location, latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) } })} /><p className="pin-note"><Icon name="map-pin-2" />{t('sighting.pinNote')}</p><label>{t('sighting.where')}<input value={workflow.location.label} maxLength={1500} onChange={(event) => dispatch({ type: 'update_location', location: { ...workflow.location, label: event.target.value } })} placeholder={t('sighting.whereHint')} /></label><label>{t('sighting.when')}<input type="datetime-local" value={workflow.location.seenAt} onChange={(event) => dispatch({ type: 'update_location', location: { ...workflow.location, seenAt: event.target.value } })} required /></label></fieldset><fieldset><legend>{t('sighting.detailsQuestion')}</legend><label>{t('sighting.details')}<textarea value={workflow.location.details} maxLength={1500} onChange={(event) => dispatch({ type: 'update_location', location: { ...workflow.location, details: event.target.value } })} placeholder={t('sighting.detailsHint')} rows={4} required /></label></fieldset>{workflow.submission === 'error' && <div className="submission-error" role="alert"><p>{workflow.error}</p><button className="secondary-button" type="button" onClick={() => void submit()}>{t('sighting.retry')}</button></div>}{workflow.submission === 'offline' && <div className="submission-error" role="status"><p>{t('sighting.offlineSaved')}</p><button className="secondary-button" type="button" onClick={() => void submit()}>{t('sighting.retry')}</button></div>}<button className="primary-cta form-submit" disabled={workflow.submission === 'saving'} type="submit">{workflow.submission === 'saving' ? t('sighting.submitting') : t('common.submitSighting')} <Icon name="arrow-right" /></button><p className="form-privacy"><Icon name="shield-check" />{t('sighting.privacy')}</p></form></main>{workflow.isCasePickerOpen && <CasePicker cases={cases} isError={isCaseOptionsError} isPending={isCaseOptionsPending} onChoose={chooseCase} onClose={() => dispatch({ type: 'close_case_picker' })} onNoMatch={() => dispatch({ type: 'clear_case' })} />}</div>
}

function SelectedCase({ caseData, onChange, onRemove }: { caseData: PublicCaseOption, onChange: () => void, onRemove: () => void }) {
  const { t } = useTranslation()
  return <div className="selected-case"><PetImage className="selected-case-photo" petName={caseData.pet_name} species={caseData.species} publicSlug={caseData.public_slug} /><div><p>{t('sighting.selectedPet')}</p><strong>{caseData.pet_name}</strong><span>{[caseData.colour, caseData.breed].filter(Boolean).join(' · ') || t(`common.${caseData.species}`)}</span></div><button type="button" className="text-button" onClick={onChange}>{t('sighting.changePet')}</button><button type="button" className="remove-selected-case" aria-label={t('sighting.removePet', { petName: caseData.pet_name })} onClick={onRemove}><Icon name="close-line" /></button></div>
}

function CasePicker({ cases, isError, isPending, onChoose, onClose, onNoMatch }: { cases: PublicCaseOption[], isError: boolean, isPending: boolean, onChoose: (slug: string) => void, onClose: () => void, onNoMatch: () => void }) {
  const { t } = useTranslation()
  return <div className="case-picker-backdrop" role="presentation" onMouseDown={onClose}><section className="case-picker" role="dialog" aria-modal="true" aria-labelledby="case-picker-title" onMouseDown={(event) => event.stopPropagation()}><div className="case-picker-heading"><div><h2 id="case-picker-title">{t('sighting.choosePetTitle')}</h2><p>{t('sighting.choosePetIntro')}</p></div><button className="case-picker-close" type="button" aria-label={t('sighting.closePicker')} onClick={onClose}><Icon name="close-line" /></button></div>{isPending ? <p className="pet-picker-help" role="status">{t('sighting.casePickerLoading')}</p> : isError ? <p className="location-error" role="alert">{t('sighting.casePickerError')}</p> : <div className="case-picker-list">{cases.map((caseData) => <button type="button" className="case-picker-card" key={caseData.public_slug} onClick={() => onChoose(caseData.public_slug)}><PetImage className="case-picker-photo" petName={caseData.pet_name} species={caseData.species} publicSlug={caseData.public_slug} /><span><strong>{caseData.pet_name}</strong><small>{[caseData.colour, caseData.breed].filter(Boolean).join(' · ') || t(`common.${caseData.species}`)}</small><em><Icon name="map-pin-2" />{caseData.last_seen_description || t('publicCase.approximateArea')}</em></span><Icon name="arrow-right" /></button>)}</div>}<button className="no-match-button" type="button" onClick={onNoMatch}>{t('sighting.noMatch')}</button></section></div>
}
