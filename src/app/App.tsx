import type { ComponentProps } from 'react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router'
import QRCode from 'qrcode'
import { defaultLocale, localeFromUrlSegment, localeUrlPrefix } from '../i18n'
import type { AppLocale } from '../i18n/resources'
import { formatDateTime } from '../i18n/format'
import { useAuth } from '../auth/useAuth'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { PetPhotoError, preparePetPhoto } from '../lib/prepare-pet-photo'
import { LocationPicker } from './LocationPicker'
import { PublicLocationMap } from './PublicLocationMap'
import { OwnerSightingMap, type SightingMapPoint } from './OwnerSightingMap'
import { NearbyDiscoveryMap, type NearbyMapPoint } from './NearbyDiscoveryMap'
import { CaseMetadata } from '../lib/metadata'

export function App() { const { t } = useTranslation(); const { acknowledgeSignIn, justSignedIn } = useAuth(); useEffect(() => { if (!justSignedIn) return; const timeout = window.setTimeout(acknowledgeSignIn, 5000); return () => window.clearTimeout(timeout) }, [acknowledgeSignIn, justSignedIn]); return <>{justSignedIn && <div className="sign-in-toast" role="status"><Icon name="check-line" />{t('auth.toast')}</div>}<Routes><Route path="/:locale?" element={<LocaleLayout />}><Route index element={<HomePage />} /><Route path="lost/new" element={<MissingCasePage />} /><Route path="dashboard" element={<OwnerDashboardPage />} /><Route path="moderation" element={<ModerationPage />} /><Route path="sighting/new" element={<SightingPage />} /><Route path="find/:slug/poster" element={<PosterPage />} /><Route path="find/:slug" element={<PublicCasePage />} /><Route path="auth" element={<AuthPlaceholder />} /><Route path="found/new" element={<ReportPlaceholder />} /><Route path="*" element={<NotFound />} /></Route></Routes></> }

function LocaleLayout() { const { locale } = useParams(); const { i18n } = useTranslation(); useEffect(() => { void i18n.changeLanguage(localeFromUrlSegment(locale) ?? defaultLocale) }, [i18n, locale]); return <Outlet /> }

function localisedPath(path: string, locale: string | undefined) { return `${localeUrlPrefix((locale ?? defaultLocale) as AppLocale)}${path}` }
function Link({ to, ...props }: ComponentProps<typeof RouterLink>) { const { i18n } = useTranslation(); return <RouterLink {...props} to={localisedPath(to.toString(), i18n.resolvedLanguage)} /> }

function HomePage() {
  const { t } = useTranslation()
  const actions = [{ description: t('home.missingDescription'), icon: 'search-eye', label: t('home.missingLabel'), to: '/lost/new', tone: 'lost' }, { description: t('home.sightingDescription'), icon: 'eye', label: t('home.sightingLabel'), to: '/sighting/new', tone: 'sighting' }, { description: t('home.foundDescription'), icon: 'home-heart', label: t('home.foundLabel'), to: '/found/new', tone: 'found' }] as const
  return <div className="page-shell"><SiteHeader /><main><section className="home-intro" aria-labelledby="actions-heading"><div className="section-heading"><p className="eyebrow">{t('home.eyebrow')}</p><h1 id="actions-heading">{t('home.title')}</h1><p className="intro-copy">{t('home.intro')}</p></div><div className="action-grid">{actions.map((action) => <Link className={`action-card ${action.tone}`} key={action.to} to={action.to}><span className="action-icon"><Icon name={action.icon} /></span><span className="action-title">{action.label}</span><span className="action-copy">{action.description}</span><span className="action-arrow"><Icon name="arrow-right" /></span></Link>)}</div></section><NearbyDiscovery /><section className="about-section" aria-labelledby="about-heading"><div><p className="eyebrow">{t('home.howItWorks')}</p><h2 id="about-heading">{t('home.howItWorksTitle')}</h2></div><div className="about-points"><p><Icon name="time" /><span><strong>{t('home.essentialsTitle')}</strong> {t('home.essentialsBody')}</span></p><p><Icon name="shield-check" /><span><strong>{t('home.privacyTitle')}</strong> {t('home.privacyBody')}</span></p><p><Icon name="community" /><span><strong>{t('home.neighboursTitle')}</strong> {t('home.neighboursBody')}</span></p></div></section></main><SiteFooter /></div>
}

type NearbyCase = Pick<PublicCase, 'public_slug' | 'pet_name' | 'species' | 'breed' | 'colour' | 'last_seen_description' | 'public_latitude' | 'public_longitude'> & { published_at: string }
type NearbySighting = { sighting_id: string, case_id: string, public_latitude: number, public_longitude: number, seen_at: string }
function NearbyDiscovery() {
  const { t } = useTranslation(); const [cases, setCases] = useState<NearbyCase[]>([]); const [sightings, setSightings] = useState<NearbySighting[]>([]); const [state, setState] = useState<'loading' | 'ready' | 'error'>(isSupabaseConfigured ? 'loading' : 'error'); const [showMap, setShowMap] = useState(false)
  useEffect(() => { if (!supabase) return; let active = true; void Promise.all([supabase.from('public_missing_cases').select('public_slug,pet_name,species,breed,colour,last_seen_description,published_at,public_latitude,public_longitude').order('published_at', { ascending: false }).limit(12), supabase.from('public_nearby_sightings').select('sighting_id,case_id,public_latitude,public_longitude,seen_at').order('seen_at', { ascending: false }).limit(24)]).then(([caseResult, sightingResult]) => { if (!active) return; if (caseResult.error || sightingResult.error) { setState('error'); return }; setCases((caseResult.data ?? []) as NearbyCase[]); setSightings((sightingResult.data ?? []) as NearbySighting[]); setState('ready') }); return () => { active = false } }, [])
  const points: NearbyMapPoint[] = [...cases.map((caseData) => ({ id: caseData.public_slug, kind: 'case' as const, latitude: Number(caseData.public_latitude), longitude: Number(caseData.public_longitude), label: t('nearby.casePin', { petName: caseData.pet_name }) })), ...sightings.map((sighting) => ({ id: sighting.sighting_id, kind: 'sighting' as const, latitude: Number(sighting.public_latitude), longitude: Number(sighting.public_longitude), label: t('nearby.sightingPin') }))]
  return <section className="nearby-section" id="nearby" aria-labelledby="nearby-heading"><div className="nearby-heading"><div><p className="eyebrow">{t('nearby.eyebrow')}</p><h2 id="nearby-heading">{t('nearby.title')}</h2><p>{t('nearby.intro')}</p></div><button className="secondary-button" type="button" onClick={() => setShowMap(!showMap)} aria-expanded={showMap}>{showMap ? <><Icon name="list-check" />{t('nearby.showList')}</> : <><Icon name="map-2" />{t('nearby.showMap')}</>}</button></div>{state === 'loading' ? <p className="nearby-message">{t('nearby.loading')}</p> : state === 'error' ? <p className="nearby-message">{t('nearby.unavailable')}</p> : cases.length === 0 ? <p className="nearby-message">{t('nearby.empty')}</p> : showMap ? <><div className="nearby-legend"><span className="missing"><i />{t('nearby.missingLegend')}</span><span className="sighting"><i />{t('nearby.sightingLegend')}</span></div><NearbyDiscoveryMap points={points} label={t('nearby.mapLabel')} /></> : <div className="nearby-list">{cases.map((caseData) => <Link key={caseData.public_slug} className="nearby-case" to={`/find/${caseData.public_slug}`}><PetImage className="nearby-photo" petName={caseData.pet_name} species={caseData.species} publicSlug={caseData.public_slug} /><div><p>{t('nearby.missingLabel')}</p><h3>{caseData.pet_name}</h3><span>{[caseData.colour, caseData.breed].filter(Boolean).join(' · ') || t(`common.${caseData.species}`)}</span><small><Icon name="map-pin-2" />{caseData.last_seen_description || t('publicCase.approximateArea')}</small></div><Icon name="arrow-right" /></Link>)}</div>}</section>
}

function MissingCasePage() {
  const { t } = useTranslation()
  const { session, isLoading } = useAuth()
  const [stage, setStage] = useState<'details' | 'location' | 'review' | 'published'>('details')
  const [species, setSpecies] = useState<'dog' | 'cat'>('dog')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoError, setPhotoError] = useState('')
  const [draft, setDraft] = useState<{ id: string, petId: string, petName: string } | null>(null)
  const [location, setLocation] = useState({ label: '', latitude: '', longitude: '', seenAt: new Date().toISOString().slice(0, 16) })
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle')
  const [error, setError] = useState('')
  const discardOnExit = useRef(true)

  async function choosePhoto(file: File | null) { setPhoto(null); setPhotoError(''); if (!file) return; try { setPhoto(await preparePetPhoto(file)) } catch (cause) { setPhotoError(t(cause instanceof PetPhotoError ? 'missingCase.invalidPhoto' : 'missingCase.preparePhotoError')) } }

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
    const { error: updateError } = await supabase.from('missing_cases').update({ exact_location: `POINT(${longitude} ${latitude})`, last_seen_at: new Date(location.seenAt).toISOString(), last_seen_description: location.label.trim() || null }).eq('id', draft.id).eq('owner_id', session.user.id)
    if (updateError) { setError(updateError.message); setState('error'); return }
    setState('idle'); setStage('review')
  }

  async function publish() {
    if (!supabase || !session || !draft) return
    setError(''); setState('saving')
    const { error: publishError } = await supabase.from('missing_cases').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', draft.id).eq('owner_id', session.user.id)
    if (publishError) { setError(publishError.message); setState('error'); return }
    discardOnExit.current = false
    setState('idle'); setStage('published')
  }

  const current = stage === 'details' ? 1 : stage === 'location' ? 2 : 3
  const selectedCoordinates = location.latitude !== '' && location.longitude !== '' ? { latitude: Number(location.latitude), longitude: Number(location.longitude) } : null
  return <div className="form-shell"><SimpleHeader onExit={exitFlow} /><main className="flow-layout">
    <Progress label={t('missingCase.progress')} total={3} current={current} />
    <section className="form-intro"><p className="eyebrow">{t('missingCase.eyebrow')}</p><h1>{stage === 'location' ? `Where was ${draft?.petName} last seen?` : stage === 'review' ? 'Review your case.' : stage === 'published' ? 'Your case is live.' : t('missingCase.title')}</h1><p>{stage === 'location' ? 'Use your current location or move the pin on the map. Only an approximate area is public.' : stage === 'review' ? 'Check the private details before publishing.' : stage === 'published' ? 'You can now share the case with people nearby.' : t('missingCase.intro')}</p></section>
    {isLoading ? <p>{t('auth.loading')}</p> : !session ? <section className="auth-card sign-in-required"><h2>{t('missingCase.signInTitle')}</h2><p>{t('missingCase.signInBody')}</p><Link className="primary-cta" to="/auth">{t('common.signIn')}<Icon name="arrow-right" /></Link></section> : stage === 'published' ? <section className="auth-card saved-pet" role="status"><Icon name="check-line" /><div><h2>Case published.</h2><p>Share the link with people nearby. The public page shows only an approximate area.</p><Link className="primary-cta" to="/">{t('common.backToHome')}</Link></div></section> : stage === 'review' ? <section className="case-form"><section className="review-card"><p className="eyebrow">Ready to publish</p><h2>{draft?.petName}</h2><dl><div><dt>Last seen</dt><dd>{location.label || 'Location set on the map'}</dd></div></dl><p className="form-privacy"><Icon name="shield-check" />{t('missingCase.exactLocationNote')}</p></section>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-cta form-submit" disabled={state === 'saving'} type="button" onClick={() => void publish()}>{state === 'saving' ? 'Publishing…' : 'Publish missing-pet case'}<Icon name="arrow-right" /></button><button className="text-button" type="button" onClick={() => setStage('location')}>Edit location</button></section> : stage === 'location' ? <form className="case-form" onSubmit={(event) => void saveLocation(event)}><fieldset><legend>{t('missingCase.lastSeenQuestion', { petName: draft?.petName ?? '' })}</legend><p className="location-help">Use your current location or move the pin on the map.</p><button className="secondary-button location-button" type="button" onClick={useCurrentLocation}><Icon name="navigation" />Use my location</button>{error && <p className="location-error" role="alert">{error}</p>}<LocationPicker coordinates={selectedCoordinates} onChange={({ latitude, longitude }) => setLocation({ ...location, latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) })} /><p className="pin-note"><Icon name="map-pin-2" />Move the pin or tap the map to set the last-seen location before continuing.</p><label>Place or landmark<input value={location.label} maxLength={1500} onChange={(event) => setLocation({ ...location, label: event.target.value })} placeholder="For example, the south gate of Victoria Park" /></label><label>{t('missingCase.lastSeen')}<input type="datetime-local" value={location.seenAt} onChange={(event) => setLocation({ ...location, seenAt: event.target.value })} required /></label></fieldset><p className="form-privacy"><Icon name="shield-check" />{t('missingCase.exactLocationNote')}</p>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-cta form-submit" disabled={state === 'saving'} type="submit">{state === 'saving' ? t('missingCase.saving') : 'Review case'}<Icon name="arrow-right" /></button></form> : <form className="case-form" onSubmit={(event) => void savePet(event)}><fieldset><legend>{t('missingCase.details')}</legend><div className="choice-row" aria-label={t('missingCase.species')}><button type="button" aria-pressed={species === 'dog'} className={`choice ${species === 'dog' ? 'selected' : ''}`} onClick={() => setSpecies('dog')}><span aria-hidden="true">🐶</span>{t('common.dog')}</button><button type="button" aria-pressed={species === 'cat'} className={`choice ${species === 'cat' ? 'selected' : ''}`} onClick={() => setSpecies('cat')}><span aria-hidden="true">🐱</span>{t('common.cat')}</button></div><label>{t('missingCase.petName')}<input name="name" maxLength={80} required /></label><div className="two-columns"><label>{t('missingCase.breed')}<input name="breed" maxLength={120} placeholder={t('missingCase.breedHint')} /></label><label>{t('missingCase.markings')}<input name="colour" maxLength={120} placeholder={t('missingCase.markingsHint')} /></label></div><label>{t('missingCase.description')}<textarea name="description" maxLength={1500} placeholder={t('missingCase.descriptionHint')} rows={4} /></label></fieldset><fieldset><legend>{t('missingCase.photo')}</legend><label className="upload-field"><Icon name="image-add" /><span><strong>{photo ? photo.name : t('missingCase.addPhoto')}</strong><small>{t('missingCase.photoHint')}</small></span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void choosePhoto(event.target.files?.[0] ?? null)} /></label>{photoError && <p className="form-error" role="alert">{photoError}</p>}</fieldset>{state === 'error' && <p className="form-error" role="alert">{error}</p>}<button className="primary-cta form-submit" disabled={state === 'saving'} type="submit"><span>{state === 'saving' ? t('missingCase.saving') : t('common.continue')}</span><Icon name="arrow-right" /></button></form>}
  </main></div>
}

type PublicCase = {
  public_slug: string
  title: string | null
  last_seen_at: string | null
  last_seen_description: string | null
  pet_name: string
  species: 'dog' | 'cat'
  breed: string | null
  colour: string | null
  pet_description: string | null
  public_latitude: number
  public_longitude: number
}

function PublicCasePage() {
  const { t, i18n } = useTranslation(); const location = useLocation()
  const { slug } = useParams()
  const [caseData, setCaseData] = useState<PublicCase | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'not-found' | 'error'>(isSupabaseConfigured ? 'loading' : 'error')

  useEffect(() => {
    if (!supabase || !slug) return
    let active = true
    void supabase.from('public_missing_cases').select('public_slug,title,last_seen_at,last_seen_description,pet_name,species,breed,colour,pet_description,public_latitude,public_longitude').eq('public_slug', slug).maybeSingle().then(({ data, error }) => {
      if (!active) return
      if (error) { setState('error'); return }
      if (!data) { setState('not-found'); return }
      setCaseData(data as PublicCase); setState('ready')
    })
    return () => { active = false }
  }, [slug])
  useEffect(() => { const token = new URLSearchParams(location.search).get('via'); if (supabase && slug && token && /^[0-9a-f-]{36}$/i.test(token)) void supabase.rpc('record_share_attribution', { case_slug: slug, share_token: token }) }, [location.search, slug])

  const content = state === 'loading' ? <PublicCaseNotice title={t('publicCase.loadingTitle')} body={t('publicCase.loadingBody')} />
    : state === 'not-found' ? <PublicCaseNotice title={t('publicCase.notFoundTitle')} body={t('publicCase.notFoundBody')} />
      : state === 'error' ? <PublicCaseNotice title={t('publicCase.unavailableTitle')} body={t('publicCase.unavailableBody')} />
        : caseData ? <PublicCaseContent caseData={caseData} locale={i18n.resolvedLanguage as AppLocale} /> : null

  return <div className="public-shell"><SiteHeader /><main className="public-case"><Link className="back-link" to="/"><Icon name="arrow-left" />{t('common.backToCases')}</Link>{content}</main><SiteFooter /></div>
}

function PublicCaseNotice({ title, body }: { title: string, body: string }) { return <section className="public-case-notice"><h1>{title}</h1><p>{body}</p></section> }

function PublicCaseContent({ caseData, locale }: { caseData: PublicCase, locale: AppLocale }) {
  const { t } = useTranslation()
  const heading = caseData.title || t('publicCase.title', { petName: caseData.pet_name })
  const descriptionTitle = [caseData.colour, caseData.breed].filter(Boolean).join(' · ') || t('publicCase.descriptionTitle')
  const lastSeen = caseData.last_seen_at ? formatDateTime(caseData.last_seen_at, locale) : t('publicCase.lastSeenUnknown')
  const area = caseData.last_seen_description || t('publicCase.approximateArea')
  return <><CaseMetadata title={`${heading} | Pet Seen`} description={t('publicCase.leadForPet', { petName: caseData.pet_name })} canonicalUrl={publicCaseUrl(caseData.public_slug, locale)} imageUrl={socialCardUrl(caseData.public_slug)} /><div className="case-grid"><PetImage className="pet-photo" petName={caseData.pet_name} species={caseData.species} publicSlug={caseData.public_slug} /><section className="case-summary"><p className="status-badge"><span />{t('publicCase.status')}</p><h1>{heading}</h1><p className="case-lead">{t('publicCase.leadForPet', { petName: caseData.pet_name })}</p><dl className="case-facts"><div><dt>{t('publicCase.lastSeen')}</dt><dd>{lastSeen}</dd></div><div><dt>{t('publicCase.area')}</dt><dd><Icon name="map-pin-2" />{area}</dd></div></dl><Link className="primary-cta report-cta" to="/sighting/new"><Icon name="eye" />{t('publicCase.action', { petName: caseData.pet_name })}</Link><p className="privacy-note"><Icon name="shield-check" />{t('publicCase.privacy', { petName: caseData.pet_name })}</p></section></div><ShareCasePanel caseData={caseData} locale={locale} heading={heading} /><section className="case-details"><div><p className="eyebrow">{t('publicCase.about', { petName: caseData.pet_name })}</p><h2>{descriptionTitle}</h2><p>{caseData.pet_description || t('publicCase.description', { petName: caseData.pet_name })}</p></div><div className="map-card"><PublicLocationMap latitude={caseData.public_latitude} longitude={caseData.public_longitude} label={t('publicCase.mapLabel', { petName: caseData.pet_name })} /><p><Icon name="information" />{t('publicCase.mapNote', { petName: caseData.pet_name })}</p></div></section><ContentReportForm caseSlug={caseData.public_slug} /></>
}

function PetImage({ className, petName, species, publicSlug, sourceUrl }: { className: string, petName: string, species: 'dog' | 'cat', publicSlug?: string, sourceUrl?: string | null }) {
  const fallback = `/images/generic-${species}.jpg`
  const publicUrl = publicSlug && import.meta.env.VITE_SUPABASE_URL ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/case-pet-photo?slug=${encodeURIComponent(publicSlug)}` : null
  const [src, setSrc] = useState(sourceUrl || publicUrl || fallback)
  useEffect(() => { setSrc(sourceUrl || publicUrl || fallback) }, [sourceUrl, publicUrl, fallback])
  return <img className={`${className} pet-placeholder`} src={src} alt={`Photo of ${petName}`} onError={() => setSrc(fallback)} />
}
function publicCaseUrl(slug: string, locale: AppLocale) { return new URL(localisedPath(`/find/${slug}`, locale), window.location.origin).toString() }
function socialCardUrl(slug: string) { const configuredBase = import.meta.env.VITE_SOCIAL_CARD_URL; return configuredBase ? `${configuredBase.replace(/\/$/, '')}?slug=${encodeURIComponent(slug)}` : new URL('/images/generic-dog.jpg', window.location.origin).toString() }
function ShareCasePanel({ caseData, locale, heading }: { caseData: PublicCase, locale: AppLocale, heading: string }) {
  const { t } = useTranslation(); const baseUrl = publicCaseUrl(caseData.public_slug, locale); const [status, setStatus] = useState(''); const shareText = t('publicCase.shareText', { petName: caseData.pet_name })
  async function attributedUrl(channel: 'copy' | 'web_share' | 'whatsapp' | 'poster') { if (!supabase) return baseUrl; const { data, error } = await supabase.rpc('create_share_attribution', { case_slug: caseData.public_slug, share_channel: channel }); return error || !data ? baseUrl : `${baseUrl}?via=${data}` }
  async function share() { try { await navigator.share({ title: heading, text: shareText, url: await attributedUrl('web_share') }); setStatus(t('publicCase.shared')) } catch (error) { if ((error as DOMException).name !== 'AbortError') setStatus(t('publicCase.shareError')) } }
  async function copy() { const url = await attributedUrl('copy'); try { await navigator.clipboard.writeText(url); setStatus(t('publicCase.copied')) } catch { const input = document.createElement('textarea'); input.value = url; input.style.position = 'fixed'; input.style.opacity = '0'; document.body.append(input); input.select(); const copied = document.execCommand('copy'); input.remove(); setStatus(copied ? t('publicCase.copied') : t('publicCase.copyError')) } }
  async function whatsApp() { const url = await attributedUrl('whatsapp'); window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`, '_blank', 'noopener,noreferrer') }
  async function poster() { const url = await attributedUrl('poster'); window.open(`${url.replace(/\?.*$/, '')}/poster?via=${new URL(url).searchParams.get('via')}`, '_blank', 'noopener,noreferrer') }
  return <section className="share-panel" aria-labelledby="share-case-heading"><div><p className="eyebrow">{t('publicCase.shareEyebrow')}</p><h2 id="share-case-heading">{t('publicCase.shareTitle')}</h2><p>{t('publicCase.shareIntro')}</p></div><div className="share-actions"><button className="secondary-button" type="button" onClick={() => void copy()}><Icon name="file-copy" />{t('publicCase.copyLink')}</button>{typeof navigator !== 'undefined' && 'share' in navigator && <button className="secondary-button" type="button" onClick={() => void share()}><Icon name="share-line" />{t('publicCase.share')}</button>}<button className="secondary-button" type="button" onClick={() => void whatsApp()}><Icon name="whatsapp" />{t('publicCase.whatsApp')}</button><button className="secondary-button" type="button" onClick={() => void poster()}><Icon name="printer" />{t('publicCase.poster')}</button></div>{status && <p className="share-status" role="status">{status}</p>}</section>
}
function PosterPage() { const { t, i18n } = useTranslation(); const { slug } = useParams(); const [caseData, setCaseData] = useState<PublicCase | null>(null); const [state, setState] = useState<'loading' | 'ready' | 'not-found' | 'error'>(isSupabaseConfigured ? 'loading' : 'error'); useEffect(() => { if (!supabase || !slug) return; let active = true; void supabase.from('public_missing_cases').select('public_slug,title,last_seen_at,last_seen_description,pet_name,species,breed,colour,pet_description,public_latitude,public_longitude').eq('public_slug', slug).maybeSingle().then(({ data, error }) => { if (!active) return; if (error) setState('error'); else if (!data) setState('not-found'); else { setCaseData(data as PublicCase); setState('ready') } }); return () => { active = false } }, [slug]); if (state !== 'ready' || !caseData) return <main className="poster-page"><PublicCaseNotice title={state === 'not-found' ? t('publicCase.notFoundTitle') : t('publicCase.loadingTitle')} body={state === 'not-found' ? t('publicCase.notFoundBody') : t('publicCase.loadingBody')} /></main>; return <Poster caseData={caseData} locale={i18n.resolvedLanguage as AppLocale} /> }
function Poster({ caseData, locale }: { caseData: PublicCase, locale: AppLocale }) { const { t } = useTranslation(); const [qrCode, setQrCode] = useState(''); const url = publicCaseUrl(caseData.public_slug, locale); const title = caseData.title || t('publicCase.title', { petName: caseData.pet_name }); useEffect(() => { void QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 1, width: 360 }).then(setQrCode) }, [url]); return <main className="poster-page"><div className="poster-toolbar"><Link className="back-link" to={`/find/${caseData.public_slug}`}><Icon name="arrow-left" />{t('common.backToCases')}</Link><button className="primary-cta" type="button" onClick={() => window.print()}><Icon name="printer" />{t('publicCase.print')}</button></div><article className="poster" aria-label={t('publicCase.posterLabel', { petName: caseData.pet_name })}><header><PetSeenMark /><span>Pet Seen</span></header><p className="poster-alert">{t('publicCase.posterAlert')}</p><h1>{title}</h1><PetImage className="poster-photo" petName={caseData.pet_name} species={caseData.species} publicSlug={caseData.public_slug} /><p className="poster-description">{[caseData.colour, caseData.breed].filter(Boolean).join(' · ') || caseData.pet_description || t('publicCase.description', { petName: caseData.pet_name })}</p><dl><div><dt>{t('publicCase.lastSeen')}</dt><dd>{caseData.last_seen_at ? formatDateTime(caseData.last_seen_at, locale) : t('publicCase.lastSeenUnknown')}</dd></div><div><dt>{t('publicCase.area')}</dt><dd>{caseData.last_seen_description || t('publicCase.approximateArea')}</dd></div></dl><footer className="poster-qr"><img src={qrCode} alt={t('publicCase.qrAlt', { petName: caseData.pet_name })} /><div><strong>{t('publicCase.qrTitle')}</strong><p>{t('publicCase.qrBody')}</p><span>{url}</span></div></footer></article></main> }

function ContentReportForm({ caseSlug }: { caseSlug: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<'incorrect' | 'harmful' | 'scam' | 'other'>('incorrect')
  const [details, setDetails] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) { setState('error'); return }
    setState('saving')
    const { error } = await supabase.rpc('submit_content_report', { case_slug: caseSlug, report_reason: reason, report_details: details || null })
    setState(error ? 'error' : 'success')
  }

  if (state === 'success') return <section className="content-report confirmation" role="status"><Icon name="check-line" /><div><strong>{t('contentReport.thanksTitle')}</strong><p>{t('contentReport.thanksBody')}</p></div></section>
  return <section className="content-report"><button className="report-link" type="button" onClick={() => setOpen(!open)} aria-expanded={open}>{t('contentReport.trigger')}</button>{open && <form onSubmit={(event) => void submit(event)}><h2>{t('contentReport.title')}</h2><p>{t('contentReport.intro')}</p><label>{t('contentReport.reason')}<select value={reason} onChange={(event) => setReason(event.target.value as typeof reason)}><option value="incorrect">{t('contentReport.reasons.incorrect')}</option><option value="harmful">{t('contentReport.reasons.harmful')}</option><option value="scam">{t('contentReport.reasons.scam')}</option><option value="other">{t('contentReport.reasons.other')}</option></select></label><label>{t('contentReport.details')}<textarea maxLength={1000} value={details} onChange={(event) => setDetails(event.target.value)} rows={3} /></label>{state === 'error' && <p className="form-error" role="alert">{t('contentReport.error')}</p>}<button className="secondary-button" disabled={state === 'saving'} type="submit">{state === 'saving' ? t('contentReport.sending') : t('contentReport.submit')}</button></form>}</section>
}

type OwnerCaseStatus = 'draft' | 'published' | 'closed' | 'reunited' | 'removed' | 'expired'

type OwnerCase = {
  id: string
  public_slug: string
  status: OwnerCaseStatus
  title: string | null
  last_seen_at: string | null
  last_seen_description: string | null
  closed_at: string | null
  published_at: string | null
  reunion_reason: 'returned_home' | 'found_by_neighbour' | 'seen_after_report' | 'other' | null
  reunion_pet_seen_attributed: boolean | null
  pet: { id: string, name: string, species: 'dog' | 'cat', breed: string | null, colour: string | null, description: string | null, pet_photos?: { display_object_path: string | null, status: 'pending' | 'processed' | 'failed' }[] } | null
}

type SightingReportStatus = 'pending' | 'confirmed' | 'dismissed'
type OwnerSighting = SightingMapPoint & { case_id: string | null, seen_at: string, location_description: string | null, details: string | null, report_status: SightingReportStatus }

const dashboardAdditions = {
  'en-GB': { 'dashboard.sightingStatusError': 'We could not update this sighting. Please try again.', 'dashboard.sightingStatusSaved': 'Sighting status updated.', 'dashboard.markReunited': 'Mark reunited', 'dashboard.reunionTitle': 'Tell us about the reunion.', 'dashboard.reunionIntro': 'This helps Pet Seen understand what made a difference.', 'dashboard.reunionReason': 'How was your pet reunited?', 'dashboard.reunionReasons.returned_home': 'They returned home', 'dashboard.reunionReasons.found_by_neighbour': 'A neighbour found them', 'dashboard.reunionReasons.seen_after_report': 'A sighting helped us find them', 'dashboard.reunionReasons.other': 'Another way', 'dashboard.petSeenHelped': 'Did Pet Seen help with the reunion?', 'dashboard.confirmReunion': 'Confirm reunion', 'dashboard.sightingStatus.pending': 'Pending review', 'dashboard.sightingStatus.confirmed': 'Confirmed', 'dashboard.sightingStatus.dismissed': 'Dismissed', 'dashboard.confirmSighting': 'Confirm', 'dashboard.dismissSighting': 'Dismiss', 'dashboard.remove': 'Remove case', 'dashboard.removeTitle': 'Remove this case?', 'dashboard.removeIntro': 'This removes the case from your account and takes its public page offline. Your pet profile will stay saved.', 'dashboard.confirmRemove': 'Remove case', 'dashboard.removeError': 'We could not remove this case. Please try again.', 'dashboard.removed': 'Case removed.' },
  'es-419': { 'dashboard.sightingStatusError': 'No pudimos actualizar este avistamiento. Inténtalo de nuevo.', 'dashboard.sightingStatusSaved': 'El estado del avistamiento se actualizó.', 'dashboard.markReunited': 'Marcar como reunido', 'dashboard.reunionTitle': 'Cuéntanos sobre el reencuentro.', 'dashboard.reunionIntro': 'Esto ayuda a Pet Seen a entender qué marcó la diferencia.', 'dashboard.reunionReason': '¿Cómo se reunió con su mascota?', 'dashboard.reunionReasons.returned_home': 'Volvió a casa', 'dashboard.reunionReasons.found_by_neighbour': 'Una persona vecina la encontró', 'dashboard.reunionReasons.seen_after_report': 'Un avistamiento ayudó a encontrarla', 'dashboard.reunionReasons.other': 'De otra manera', 'dashboard.petSeenHelped': '¿Pet Seen ayudó con el reencuentro?', 'dashboard.confirmReunion': 'Confirmar reencuentro', 'dashboard.sightingStatus.pending': 'Pendiente de revisión', 'dashboard.sightingStatus.confirmed': 'Confirmado', 'dashboard.sightingStatus.dismissed': 'Descartado', 'dashboard.confirmSighting': 'Confirmar', 'dashboard.dismissSighting': 'Descartar', 'dashboard.remove': 'Eliminar caso', 'dashboard.removeTitle': '¿Eliminar este caso?', 'dashboard.removeIntro': 'Esto elimina el caso de tu cuenta y quita su página pública. El perfil de tu mascota seguirá guardado.', 'dashboard.confirmRemove': 'Eliminar caso', 'dashboard.removeError': 'No pudimos eliminar este caso. Inténtalo de nuevo.', 'dashboard.removed': 'Caso eliminado.' },
} as const

function dashboardTranslation(translate: unknown, locale: string | undefined) {
  const typedTranslate = translate as (key: string, ...args: unknown[]) => string
  const additions = dashboardAdditions[locale === 'es-419' ? 'es-419' : 'en-GB'] as Record<string, string>
  return (key: string, ...args: unknown[]) => additions[key] ?? typedTranslate(key, ...args)
}

function dateTimeLocalValue(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function OwnerDashboardPage() {
  const { t: translated, i18n } = useTranslation()
  const t = dashboardTranslation(translated, i18n.resolvedLanguage)
  const { isLoading, session } = useAuth()
  const [cases, setCases] = useState<OwnerCase[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [sightings, setSightings] = useState<OwnerSighting[]>([])
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})

  const loadCases = useCallback(async () => {
    if (!supabase || !session) return
    const client = supabase
    setState('loading')
    const { data, error } = await client.from('missing_cases').select('id,public_slug,status,title,last_seen_at,last_seen_description,closed_at,published_at,reunion_reason,reunion_pet_seen_attributed,pet:pets(id,name,species,breed,colour,description,pet_photos(display_object_path,status))').eq('owner_id', session.user.id).order('created_at', { ascending: false })
    if (error) { setState('error'); return }
    const ownerCases = (data ?? []).map((caseData) => ({ ...caseData, pet: Array.isArray(caseData.pet) ? caseData.pet[0] ?? null : caseData.pet })) as OwnerCase[]
    setCases(ownerCases)
    const signedPhotos = await Promise.all(ownerCases.map(async (caseData) => {
      const displayPath = caseData.pet?.pet_photos?.find((photo) => photo.status === 'processed')?.display_object_path
      if (!displayPath) return [caseData.id, ''] as const
      const { data: signed } = await client.storage.from('pet-photos').createSignedUrl(displayPath, 60 * 60)
      return [caseData.id, signed?.signedUrl ?? ''] as const
    }))
    setPhotoUrls(Object.fromEntries(signedPhotos.filter(([, url]) => Boolean(url))))
    const caseIds = ownerCases.map((caseData) => caseData.id)
    if (caseIds.length > 0) {
      const { data: sightingData, error: sightingsError } = await client.from('owner_case_sightings').select('id,case_id,seen_at,location_description,details,report_status,latitude,longitude').in('case_id', caseIds).order('seen_at', { ascending: false })
      if (sightingsError) { setState('error'); return }
      setSightings((sightingData ?? []).map((sighting) => ({ ...sighting, latitude: Number(sighting.latitude), longitude: Number(sighting.longitude), label: sighting.location_description || 'Reported sighting' })) as OwnerSighting[])
    } else setSightings([])
    setState('ready')
  }, [session])

  useEffect(() => { if (session) void loadCases() }, [session, loadCases])

  async function saveCase(event: FormEvent<HTMLFormElement>, caseData: OwnerCase) {
    event.preventDefault()
    if (!supabase || !session || !caseData.pet) return
    const fields = new FormData(event.currentTarget)
    setSavingId(caseData.id); setMessage('')
    const petUpdate = await supabase.from('pets').update({ name: String(fields.get('name') ?? '').trim(), breed: String(fields.get('breed') ?? '').trim() || null, colour: String(fields.get('colour') ?? '').trim() || null, description: String(fields.get('description') ?? '').trim() || null }).eq('id', caseData.pet.id).eq('owner_id', session.user.id)
    const caseUpdate = await supabase.from('missing_cases').update({ title: String(fields.get('title') ?? '').trim() || null, last_seen_description: String(fields.get('place') ?? '').trim() || null, last_seen_at: String(fields.get('lastSeenAt') ?? '') ? new Date(String(fields.get('lastSeenAt'))).toISOString() : null }).eq('id', caseData.id).eq('owner_id', session.user.id)
    setSavingId(null)
    if (petUpdate.error || caseUpdate.error) { setMessage(t('dashboard.saveError')); return }
    setEditingId(null); setMessage(t('dashboard.saved')); await loadCases()
  }

  async function changeStatus(caseData: OwnerCase, status: Extract<OwnerCaseStatus, 'published' | 'closed' | 'reunited'>, reunion?: { reason: NonNullable<OwnerCase['reunion_reason']>, attributed: boolean }) {
    if (!supabase || !session) return
    setSavingId(caseData.id); setMessage('')
    const updates = status === 'published'
      ? { status, closed_at: null, published_at: caseData.published_at ?? new Date().toISOString(), reunion_reason: null, reunion_pet_seen_attributed: null }
      : status === 'reunited' && reunion
        ? { status, closed_at: new Date().toISOString(), reunion_reason: reunion.reason, reunion_pet_seen_attributed: reunion.attributed }
        : { status, closed_at: new Date().toISOString() }
    const { error } = await supabase.from('missing_cases').update(updates).eq('id', caseData.id).eq('owner_id', session.user.id)
    setSavingId(null)
    if (error) { setMessage(t('dashboard.statusError')); return }
    setMessage(t('dashboard.statusSaved')); await loadCases()
  }

  async function removeCase(caseData: OwnerCase) {
    if (!supabase || !session) return
    setSavingId(caseData.id); setMessage('')
    const { error } = await supabase.from('missing_cases').delete().eq('id', caseData.id).eq('owner_id', session.user.id)
    setSavingId(null)
    if (error) { setMessage(t('dashboard.removeError')); return }
    setEditingId(null); setMessage(t('dashboard.removed')); await loadCases()
  }

  if (isLoading) return <main className="dashboard-shell"><p>{t('auth.loading')}</p></main>
  if (!session) return <main className="dashboard-shell"><section className="auth-card"><p className="eyebrow">{t('dashboard.eyebrow')}</p><h1>{t('dashboard.signInTitle')}</h1><p>{t('dashboard.signInBody')}</p><Link className="primary-cta" to="/auth">{t('common.signIn')}<Icon name="arrow-right" /></Link></section></main>
  async function reviewSighting(sighting: OwnerSighting, status: Exclude<SightingReportStatus, 'pending'>) {
    if (!supabase) return
    setSavingId(sighting.id); setMessage('')
    const { error } = await supabase.rpc('review_sighting', { target_sighting_id: sighting.id, next_status: status })
    setSavingId(null)
    if (error) { setMessage(t('dashboard.sightingStatusError')); return }
    setMessage(t('dashboard.sightingStatusSaved')); await loadCases()
  }

  return <div className="dashboard-page"><SiteHeader /><main className="dashboard-shell"><div className="dashboard-intro"><div><p className="eyebrow">{t('dashboard.eyebrow')}</p><h1>{t('dashboard.title')}</h1><p>{t('dashboard.intro')}</p></div><Link className="secondary-button dashboard-new" to="/lost/new"><Icon name="add-line" />{t('dashboard.newCase')}</Link></div>{message && <p className="dashboard-message" role="status">{message}</p>}{state === 'loading' ? <p>{t('dashboard.loading')}</p> : state === 'error' ? <p className="form-error">{t('dashboard.loadError')}</p> : cases.length === 0 ? <section className="dashboard-empty"><h2>{t('dashboard.emptyTitle')}</h2><p>{t('dashboard.emptyBody')}</p><Link className="primary-cta" to="/lost/new">{t('dashboard.newCase')}<Icon name="arrow-right" /></Link></section> : <div className="case-list">{cases.map((caseData) => <OwnerCaseCard key={caseData.id} caseData={caseData} photoUrl={photoUrls[caseData.id]} sightings={sightings.filter((sighting) => sighting.case_id === caseData.id)} editing={editingId === caseData.id} locale={i18n.resolvedLanguage as AppLocale} saving={savingId === caseData.id} onEdit={() => setEditingId(caseData.id)} onCancel={() => setEditingId(null)} onSave={saveCase} onStatus={changeStatus} onRemove={removeCase} onReviewSighting={reviewSighting} />)}</div>}</main><SiteFooter /></div>
}

function OwnerCaseCard({ caseData, photoUrl, sightings, editing, locale, saving, onEdit, onCancel, onSave, onStatus, onRemove, onReviewSighting }: { caseData: OwnerCase, photoUrl?: string, sightings: OwnerSighting[], editing: boolean, locale: AppLocale, saving: boolean, onEdit: () => void, onCancel: () => void, onSave: (event: FormEvent<HTMLFormElement>, caseData: OwnerCase) => Promise<void>, onStatus: (caseData: OwnerCase, status: Extract<OwnerCaseStatus, 'published' | 'closed' | 'reunited'>, reunion?: { reason: NonNullable<OwnerCase['reunion_reason']>, attributed: boolean }) => Promise<void>, onRemove: (caseData: OwnerCase) => Promise<void>, onReviewSighting: (sighting: OwnerSighting, status: Exclude<SightingReportStatus, 'pending'>) => Promise<void> }) {
  const { t: translated, i18n } = useTranslation()
  const t = dashboardTranslation(translated, i18n.resolvedLanguage)
  const pet = caseData.pet
  const [reunionOpen, setReunionOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [reunionReason, setReunionReason] = useState<NonNullable<OwnerCase['reunion_reason']>>('returned_home')
  const [attributed, setAttributed] = useState<boolean | null>(null)
  if (!pet) return null
  const active = caseData.status === 'published'
  const canManage = ['published', 'closed', 'reunited'].includes(caseData.status)
  const title = caseData.title || t('publicCase.title', { petName: pet.name })
  function submitReunion(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (attributed === null) return; void onStatus(caseData, 'reunited', { reason: reunionReason, attributed }).then(() => setReunionOpen(false)) }
  return <article className={`owner-case ${caseData.status}`}><PetImage className="owner-case-photo" petName={pet.name} species={pet.species} sourceUrl={photoUrl} /><div className="owner-case-body"><div className="owner-case-heading"><div><p className={`owner-status ${caseData.status}`}><span className="status-dot" />{t(`dashboard.status.${caseData.status}`)}{caseData.status === 'reunited' && <span className="reunion-emoji" aria-hidden="true">🎉</span>}</p><h2>{title}</h2></div>{active && <Link className="case-link" to={`/find/${caseData.public_slug}`}>{t('dashboard.viewPublic')}<Icon name="external-link" /></Link>}</div>{editing ? <form className="owner-edit-form" onSubmit={(event) => void onSave(event, caseData)}><label>{t('dashboard.caseTitle')}<input name="title" defaultValue={caseData.title ?? ''} maxLength={140} /></label><div className="two-columns"><label>{t('dashboard.petName')}<input name="name" defaultValue={pet.name} maxLength={80} required /></label><label>{t('dashboard.breed')}<input name="breed" defaultValue={pet.breed ?? ''} maxLength={120} /></label></div><label>{t('dashboard.colour')}<input name="colour" defaultValue={pet.colour ?? ''} maxLength={120} /></label><label>{t('dashboard.description')}<textarea name="description" defaultValue={pet.description ?? ''} maxLength={1500} rows={3} /></label><label>{t('dashboard.lastSeenPlace')}<input name="place" defaultValue={caseData.last_seen_description ?? ''} maxLength={1500} /></label><label>{t('dashboard.lastSeenTime')}<input name="lastSeenAt" defaultValue={dateTimeLocalValue(caseData.last_seen_at)} type="datetime-local" /></label><p className="form-privacy"><Icon name="shield-check" />{t('dashboard.locationNote')}</p><div className="owner-form-actions"><button className="primary-cta" disabled={saving} type="submit">{saving ? t('dashboard.saving') : t('dashboard.saveChanges')}</button><button className="text-button" type="button" onClick={onCancel}>{t('dashboard.cancel')}</button></div></form> : <><dl className="owner-case-details"><div><dt>{t('dashboard.pet')}</dt><dd>{pet.name} · {t(`common.${pet.species}`)}</dd></div><div><dt>{t('publicCase.lastSeen')}</dt><dd>{caseData.last_seen_at ? formatDateTime(caseData.last_seen_at, locale) : t('publicCase.lastSeenUnknown')}</dd></div></dl>{canManage ? <div className="owner-case-actions"><button className="secondary-button" type="button" onClick={onEdit}><Icon name="edit-line" />{t('dashboard.edit')}</button><label className="status-control">{t('dashboard.changeStatus')}<select aria-label={t('dashboard.changeStatus')} disabled={saving} value={caseData.status} onChange={(event) => { const status = event.target.value as Extract<OwnerCaseStatus, 'published' | 'closed'>; void onStatus(caseData, status) }}><option value="published">{t('dashboard.status.published')}</option><option value="closed">{t('dashboard.status.closed')}</option></select></label>{caseData.status === 'published' && <button className="reunited-button" type="button" onClick={() => setReunionOpen(true)}><Icon name="heart-3-line" />{t('dashboard.markReunited')}</button>}</div> : <p className="owner-case-closed">{caseData.status === 'reunited' ? t('dashboard.reunitedNote') : t('dashboard.closedNote')}</p>}{removeOpen ? <section className="remove-case" aria-labelledby={`remove-case-${caseData.id}`}><h3 id={`remove-case-${caseData.id}`}>{t('dashboard.removeTitle')}</h3><p>{t('dashboard.removeIntro')}</p><div className="owner-form-actions"><button className="danger-button" disabled={saving} type="button" onClick={() => void onRemove(caseData)}>{t('dashboard.confirmRemove')}</button><button className="text-button" disabled={saving} type="button" onClick={() => setRemoveOpen(false)}>{t('dashboard.cancel')}</button></div></section> : <button className="remove-case-button" disabled={saving} type="button" onClick={() => setRemoveOpen(true)}><Icon name="delete-bin-line" />{t('dashboard.remove')}</button>}{reunionOpen && <form className="reunion-form" onSubmit={submitReunion}><h3>{t('dashboard.reunionTitle')}</h3><p>{t('dashboard.reunionIntro')}</p><label>{t('dashboard.reunionReason')}<select value={reunionReason} onChange={(event) => setReunionReason(event.target.value as typeof reunionReason)}><option value="returned_home">{t('dashboard.reunionReasons.returned_home')}</option><option value="found_by_neighbour">{t('dashboard.reunionReasons.found_by_neighbour')}</option><option value="seen_after_report">{t('dashboard.reunionReasons.seen_after_report')}</option><option value="other">{t('dashboard.reunionReasons.other')}</option></select></label><fieldset><legend>{t('dashboard.petSeenHelped')}</legend><label><input checked={attributed === true} name={`attribution-${caseData.id}`} onChange={() => setAttributed(true)} type="radio" />{t('common.yes')}</label><label><input checked={attributed === false} name={`attribution-${caseData.id}`} onChange={() => setAttributed(false)} type="radio" />{t('common.no')}</label></fieldset><div className="owner-form-actions"><button className="primary-cta" disabled={saving || attributed === null} type="submit">{t('dashboard.confirmReunion')}</button><button className="text-button" type="button" onClick={() => setReunionOpen(false)}>{t('dashboard.cancel')}</button></div></form>}{sightings.length > 0 && <section className="sighting-timeline"><div><p className="eyebrow">{t('dashboard.sightings')}</p><h3>{t('dashboard.sightingTimeline')}</h3><p>{t('dashboard.sightingPrivacy')}</p></div><OwnerSightingMap points={sightings} /><ol>{sightings.map((sighting) => <li key={sighting.id}><strong>{formatDateTime(sighting.seen_at, locale)}</strong><span>{sighting.location_description || t('dashboard.coordinates')}</span>{sighting.details && <p>{sighting.details}</p>}<div className="sighting-review"><span className={`sighting-status ${sighting.report_status}`}>{t(`dashboard.sightingStatus.${sighting.report_status}`)}</span>{sighting.report_status === 'pending' && <div><button disabled={saving} onClick={() => void onReviewSighting(sighting, 'confirmed')} type="button">{t('dashboard.confirmSighting')}</button><button disabled={saving} onClick={() => void onReviewSighting(sighting, 'dismissed')} type="button">{t('dashboard.dismissSighting')}</button></div>}</div></li>)}</ol></section>}</>}</div></article>
}

type ContentReportStatus = 'open' | 'reviewed' | 'dismissed' | 'actioned'
type ModerationReport = { id: string, reason: 'incorrect' | 'harmful' | 'scam' | 'other', details: string | null, status: ContentReportStatus, created_at: string, case: { public_slug: string, title: string | null, pet: { name: string } | null } | null }

function ModerationPage() {
  const { t, i18n } = useTranslation()
  const { isLoading, session } = useAuth()
  const [access, setAccess] = useState<'checking' | 'allowed' | 'denied'>('checking')
  const [reports, setReports] = useState<ModerationReport[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [savingId, setSavingId] = useState<string | null>(null)
  const loadReports = useCallback(async () => { if (!supabase) return; setState('loading'); const { data, error } = await supabase.from('content_reports').select('id,reason,details,status,created_at,case:missing_cases(public_slug,title,pet:pets(name))').order('created_at', { ascending: false }); if (error) { setState('error'); return }; setReports((data ?? []).map((report) => { const caseData = Array.isArray(report.case) ? report.case[0] ?? null : report.case; return { ...report, case: caseData ? { ...caseData, pet: Array.isArray(caseData.pet) ? caseData.pet[0] ?? null : caseData.pet } : null } }) as unknown as ModerationReport[]); setState('ready') }, [])
  useEffect(() => { if (!session || !supabase) { setAccess('denied'); return }; void supabase.rpc('is_authorized_staff').then(({ data, error }) => { const allowed = !error && data === true; setAccess(allowed ? 'allowed' : 'denied'); if (allowed) void loadReports() }) }, [loadReports, session])
  async function updateStatus(report: ModerationReport, status: ContentReportStatus) { if (!supabase) return; setSavingId(report.id); const { error } = await supabase.from('content_reports').update({ status }).eq('id', report.id); setSavingId(null); if (!error) await loadReports() }
  if (isLoading || access === 'checking') return <main className="moderation-shell"><p>{t('moderation.checking')}</p></main>
  if (access === 'denied') return <main className="moderation-shell"><section className="auth-card"><p className="eyebrow">{t('moderation.eyebrow')}</p><h1>{t('moderation.deniedTitle')}</h1><p>{t('moderation.deniedBody')}</p><Link className="primary-cta" to={session ? '/' : '/auth'}>{session ? t('common.backToHome') : t('common.signIn')}<Icon name="arrow-right" /></Link></section></main>
  return <div className="moderation-page"><SiteHeader /><main className="moderation-shell"><section className="moderation-intro"><p className="eyebrow">{t('moderation.eyebrow')}</p><h1>{t('moderation.title')}</h1><p>{t('moderation.intro')}</p></section>{state === 'loading' ? <p>{t('moderation.loading')}</p> : state === 'error' ? <p className="form-error">{t('moderation.error')}</p> : reports.length === 0 ? <section className="dashboard-empty"><h2>{t('moderation.emptyTitle')}</h2><p>{t('moderation.emptyBody')}</p></section> : <div className="moderation-list">{reports.map((report) => <article className="moderation-report" key={report.id}><div><p className={`moderation-status ${report.status}`}>{t(`moderation.status.${report.status}`)}</p><h2>{report.case?.title || (report.case?.pet?.name ? t('publicCase.title', { petName: report.case.pet.name }) : t('moderation.unavailableCase'))}</h2><p className="report-meta">{t(`contentReport.reasons.${report.reason}`)} · {formatDateTime(report.created_at, i18n.resolvedLanguage as AppLocale)}</p>{report.details && <p className="report-details">{report.details}</p>}{report.case && <Link className="case-link" to={`/find/${report.case.public_slug}`}>{t('moderation.viewCase')}<Icon name="external-link" /></Link>}</div><label className="status-control">{t('moderation.statusLabel')}<select aria-label={t('moderation.statusLabel')} disabled={savingId === report.id} value={report.status} onChange={(event) => void updateStatus(report, event.target.value as ContentReportStatus)}><option value="open">{t('moderation.status.open')}</option><option value="reviewed">{t('moderation.status.reviewed')}</option><option value="dismissed">{t('moderation.status.dismissed')}</option><option value="actioned">{t('moderation.status.actioned')}</option></select></label></article>)}</div>}</main><SiteFooter /></div>
}

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

function SightingPage() {
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

function Progress({ label, total, current = 1 }: { label: string, total: number, current?: number }) { const { t } = useTranslation(); const step = t('missingCase.step', { current, total }); return <div className="progress" aria-label={step}><span className="progress-label">{label}</span><span>{step}</span><div className="progress-track"><span style={{ width: `${(current / total) * 100}%` }} /></div></div> }
function SiteHeader() { const { t } = useTranslation(); const { session } = useAuth(); return <header className="site-header"><Link className="wordmark" to="/" aria-label={t('common.petSeenHome')}><PetSeenMark />Pet Seen</Link><nav aria-label={t('common.petSeenHome')}><Link className="nearby-link" to="/#nearby"><Icon name="map-pin-2" />{t('common.nearbyPets')}</Link><LanguagePicker /><Link className="sign-in" to={session ? '/dashboard' : '/auth'}><Icon name="user-3" />{session ? t('common.account') : t('common.signIn')}</Link></nav></header> }
function LanguagePicker() { const { i18n, t } = useTranslation(); const location = useLocation(); const navigate = useNavigate(); return <label className="language-picker"><span className="sr-only">{t('language.label')}</span><Icon name="global" /><select aria-label={t('language.label')} value={i18n.resolvedLanguage} onChange={(event) => { const locale = event.target.value as AppLocale; const path = location.pathname.replace(/^\/es(?=\/|$)/, '') || '/'; navigate(`${localisedPath(path, locale)}${location.search}${location.hash}`); }}><option value="en-GB">{t('language.english')}</option><option value="es-419">{t('language.spanish')}</option></select></label> }
function SimpleHeader({ onExit }: { onExit?: () => Promise<boolean> }) { const { t, i18n } = useTranslation(); const navigate = useNavigate(); async function leaveFlow(event: React.MouseEvent<HTMLAnchorElement>) { if (!onExit) return; event.preventDefault(); if (await onExit()) navigate(localisedPath('/', i18n.resolvedLanguage)) } return <header className="simple-header"><Link className="wordmark" to="/" aria-label={t('common.petSeenHome')} onClick={leaveFlow}><PetSeenMark />Pet Seen</Link><LanguagePicker /><Link className="back-link small-back" to="/" onClick={leaveFlow}><Icon name="arrow-left" />{t('common.backToHome')}</Link></header> }
function SiteFooter() { const { t } = useTranslation(); return <footer><span>Pet Seen</span><span>{t('footer')}</span></footer> }
function PetSeenMark() { return <svg className="wordmark-mark" viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="7.5" cy="20.4" rx="5.2" ry="7" transform="rotate(-31 7.5 20.4)" /><ellipse cx="16.8" cy="9.7" rx="5.6" ry="7.3" transform="rotate(-7 16.8 9.7)" /><ellipse cx="31.2" cy="9.7" rx="5.6" ry="7.3" transform="rotate(7 31.2 9.7)" /><ellipse cx="40.5" cy="20.4" rx="5.2" ry="7" transform="rotate(31 40.5 20.4)" /><path d="M24 25.8c-5.1 0-8.4 4-11.4 7.8-2.8 3.4-6 5.2-6 8.8 0 3.7 3.5 6 7.8 6 3.7 0 5.7-1.6 9.6-1.6s5.9 1.6 9.6 1.6c4.3 0 7.8-2.3 7.8-6 0-3.6-3.2-5.4-6-8.8-3-3.8-6.3-7.8-11.4-7.8Z" /></svg> }
function Icon({ name }: { name: string }) { return <i className={`ri-${name}-line`} aria-hidden="true" /> }
function ReportPlaceholder() { const { t } = useTranslation(); return <main className="placeholder-page"><Link className="back-link" to="/"><Icon name="arrow-left" />{t('common.backToHome')}</Link><p className="eyebrow">{t('placeholders.laterRelease')}</p><h1>{t('placeholders.foundTitle')}</h1><p>{t('placeholders.foundBody')}</p></main> }
function AuthPlaceholder() { const { t, i18n } = useTranslation(); const { isLoading, justSignedIn, session } = useAuth(); const navigate = useNavigate(); const [email, setEmail] = useState(''); const [state, setState] = useState<'idle' | 'sent' | 'error'>('idle'); const [error, setError] = useState(''); useEffect(() => { if (justSignedIn && session) navigate(localisedPath('/dashboard', i18n.resolvedLanguage), { replace: true }) }, [i18n.resolvedLanguage, justSignedIn, navigate, session]); async function sendMagicLink(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!supabase) { setError(t('auth.notConfigured')); setState('error'); return }; setError(''); const redirectTo = `${window.location.origin}${localisedPath('/auth', i18n.resolvedLanguage)}`; const { error: signInError } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } }); if (signInError) { setError(signInError.message); setState('error'); return }; setState('sent') } async function signOut() { await supabase?.auth.signOut() } return <main className="auth-page"><Link className="back-link" to="/"><Icon name="arrow-left" />{t('common.backToHome')}</Link><section className="auth-card" aria-labelledby="auth-heading"><p className="eyebrow">{t('auth.eyebrow')}</p>{isLoading ? <p>{t('auth.loading')}</p> : session ? <><h1 id="auth-heading">{t('auth.accountTitle')}</h1><p>{t('auth.signedInBody', { email: session.user.email ?? '' })}</p><Link className="primary-cta" to="/dashboard">{t('dashboard.title')}<Icon name="arrow-right" /></Link><button className="secondary-button" type="button" onClick={() => void signOut()}>{t('auth.signOut')}</button></> : <><h1 id="auth-heading">{t('auth.title')}</h1><p>{t('auth.intro')}</p>{state === 'sent' ? <div className="auth-notice" role="status"><Icon name="mail-check" /><div><strong>{t('auth.sentTitle')}</strong><span>{t('auth.sentBody', { email })}</span></div></div> : <form className="auth-form" onSubmit={(event) => void sendMagicLink(event)}><label htmlFor="email">{t('auth.emailLabel')}<input id="email" autoComplete="email" inputMode="email" onChange={(event) => setEmail(event.target.value)} placeholder={t('auth.emailHint')} required type="email" value={email} /></label>{state === 'error' && <p className="form-error" role="alert">{error}</p>}<button className="primary-cta" type="submit">{t('auth.sendLink')}<Icon name="arrow-right" /></button></form>}<p className="auth-note"><Icon name="shield-check" />{isSupabaseConfigured ? t('auth.privacy') : t('auth.setupNote')}</p></>}</section></main> }
function NotFound() { const { t } = useTranslation(); return <main className="placeholder-page"><p className="eyebrow">{t('placeholders.notFound')}</p><h1>{t('placeholders.notFoundTitle')}</h1><Link className="primary-cta" to="/">{t('common.goHome')}</Link></main> }
