import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { OwnerSightingMap, type SightingMapPoint } from '../../components/maps/OwnerSightingMap'
import { useAuth } from '../../auth/useAuth'
import { Icon } from '../../components/Icon'
import { PetImage } from '../../components/PetImage'
import { Link, SiteFooter, SiteHeader } from '../../components/SiteChrome'
import { formatDateTime } from '../../i18n/format'
import type { AppLocale } from '../../i18n/resources'
import { supabase } from '../../lib/supabase'
import { enablePushNotifications, pushNotificationsSupported } from '../../lib/push-notifications'

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
type FoundMatch = { found_pet_report_id: string, case_id: string, match_score: number, match_reasons: string[], status: 'pending_owner' | 'confirmed', report: { species: 'dog' | 'cat', breed: string | null, colour: string | null, details: string, custody_status: 'with_reporter' | 'with_vet_or_rescue' | 'not_in_custody', found_at: string, location_description: string | null, photo: { display_object_path: string | null } | null } | null }

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

export function OwnerDashboardPage() {
  const { t: translated, i18n } = useTranslation()
  const t = dashboardTranslation(translated, i18n.resolvedLanguage)
  const { isLoading, session } = useAuth()
  const [cases, setCases] = useState<OwnerCase[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [sightings, setSightings] = useState<OwnerSighting[]>([])
  const [foundMatches, setFoundMatches] = useState<FoundMatch[]>([])
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
      const [sightingResult, matchResult] = await Promise.all([client.from('owner_case_sightings').select('id,case_id,seen_at,location_description,details,report_status,latitude,longitude').in('case_id', caseIds).order('seen_at', { ascending: false }), client.from('found_pet_case_links').select('found_pet_report_id,case_id,match_score,match_reasons,status,report:found_pet_reports(species,breed,colour,details,custody_status,found_at,location_description,photo:found_pet_photos(display_object_path))').in('case_id', caseIds).in('status', ['pending_owner', 'confirmed'])])
      const { data: sightingData, error: sightingsError } = sightingResult
      if (sightingsError || matchResult.error) { setState('error'); return }
      setSightings((sightingData ?? []).map((sighting) => ({ ...sighting, latitude: Number(sighting.latitude), longitude: Number(sighting.longitude), label: sighting.location_description || 'Reported sighting' })) as OwnerSighting[])
      setFoundMatches((matchResult.data ?? []).map((match) => ({ ...match, report: Array.isArray(match.report) ? match.report[0] ?? null : match.report })) as unknown as FoundMatch[])
    } else { setSightings([]); setFoundMatches([]) }
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
  async function reviewFoundMatch(match: FoundMatch, decision: 'confirmed' | 'declined') { if (!supabase) return; setSavingId(match.found_pet_report_id); setMessage(''); const { error } = await supabase.rpc('review_found_pet_match', { target_report_id: match.found_pet_report_id, target_case_id: match.case_id, decision }); setSavingId(null); if (error) { setMessage(error.message); return }; setMessage(decision === 'confirmed' ? 'Found-pet match confirmed.' : 'Found-pet match declined.'); await loadCases() }

  const pendingFoundMatch = foundMatches.find((match) => match.status === 'pending_owner')
  if (pendingFoundMatch) return <FoundMatchReview match={pendingFoundMatch} saving={savingId === pendingFoundMatch.found_pet_report_id} onReview={reviewFoundMatch} />

  return <div className="dashboard-page"><SiteHeader /><main className="dashboard-shell"><div className="dashboard-intro"><div><p className="eyebrow">{t('dashboard.eyebrow')}</p><h1>{t('dashboard.title')}</h1><p>{t('dashboard.intro')}</p></div><Link className="secondary-button dashboard-new" to="/lost/new"><Icon name="add-line" />{t('dashboard.newCase')}</Link></div><WatchAreas sessionUserId={session.user.id} />{message && <p className="dashboard-message" role="status">{message}</p>}{state === 'loading' ? <p>{t('dashboard.loading')}</p> : state === 'error' ? <p className="form-error">{t('dashboard.loadError')}</p> : cases.length === 0 ? <section className="dashboard-empty"><h2>{t('dashboard.emptyTitle')}</h2><p>{t('dashboard.emptyBody')}</p><Link className="primary-cta" to="/lost/new">{t('dashboard.newCase')}<Icon name="arrow-right" /></Link></section> : <><div className="case-list">{cases.map((caseData) => <OwnerCaseCard key={caseData.id} caseData={caseData} photoUrl={photoUrls[caseData.id]} sightings={sightings.filter((sighting) => sighting.case_id === caseData.id)} matches={foundMatches.filter((match) => match.case_id === caseData.id)} editing={editingId === caseData.id} locale={i18n.resolvedLanguage as AppLocale} saving={savingId === caseData.id} onEdit={() => setEditingId(caseData.id)} onCancel={() => setEditingId(null)} onSave={saveCase} onStatus={changeStatus} onRemove={removeCase} onReviewSighting={reviewSighting} onReviewFoundMatch={reviewFoundMatch} />)}</div><ConfirmedConversations matches={foundMatches.filter((match) => match.status === 'confirmed')} /></>}</main><SiteFooter /></div>
}

type WatchArea = { id: string, label: string, radius_metres: number }

function WatchAreas({ sessionUserId }: { sessionUserId: string }) {
  const [areas, setAreas] = useState<WatchArea[]>([]), [label, setLabel] = useState(''), [radius, setRadius] = useState(2000), [position, setPosition] = useState<{ latitude: number, longitude: number } | null>(null), [status, setStatus] = useState(''), [saving, setSaving] = useState(false)
  const configuredVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
  const load = useCallback(async () => { if (!supabase) return; const { data } = await supabase.from('watch_areas').select('id,label,radius_metres').order('created_at', { ascending: false }); setAreas((data ?? []) as WatchArea[]) }, [])
  useEffect(() => { void load() }, [load])
  function useLocation() { if (!navigator.geolocation) { setStatus('Your browser cannot provide a location.'); return }; setStatus(''); navigator.geolocation.getCurrentPosition(({ coords }) => { setPosition({ latitude: coords.latitude, longitude: coords.longitude }); setStatus('Location selected. Give this area a name before saving.') }, () => setStatus('We could not access your location. Check your browser permission and try again.'), { maximumAge: 60_000, timeout: 15_000 }) }
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!supabase || !position || !label.trim()) { setStatus('Choose your location and enter an area name first.'); return }; setSaving(true); setStatus(''); const { error } = await supabase.from('watch_areas').insert({ owner_id: sessionUserId, label: label.trim(), radius_metres: radius, centre: `POINT(${position.longitude} ${position.latitude})` }); setSaving(false); if (error) { setStatus('We could not save that watch area. Please try again.'); return }; setLabel(''); setPosition(null); setStatus('Watch area saved. We will alert you about new reports nearby.'); await load() }
  async function enablePush() { if (!supabase) return; setSaving(true); setStatus(''); try { await enablePushNotifications(supabase, configuredVapidKey ?? ''); setStatus('Push notifications are on for this browser.') } catch (error) { setStatus(error instanceof Error ? error.message : 'We could not enable push notifications.') } finally { setSaving(false) } }
  async function remove(id: string) { if (!supabase) return; await supabase.from('watch_areas').delete().eq('id', id); await load() }
  return <section className="watch-areas" aria-labelledby="watch-areas-title"><div><p className="eyebrow">Local alerts</p><h2 id="watch-areas-title">Watch an area</h2><p>Use your current location to set the area, then choose an alert radius and a private name for it. Alerts never include the exact location; email is used if push cannot reach this browser.</p></div><form onSubmit={(event) => void save(event)}><button className="secondary-button" onClick={useLocation} type="button"><Icon name="map-pin-user" />{position ? 'Current location selected' : 'Use current location'}</button><label>Name this saved location<input maxLength={100} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. Home" value={label} /></label><label>Alert radius<select onChange={(event) => setRadius(Number(event.target.value))} value={radius}><option value={500}>500 metres</option><option value={1000}>1 kilometre</option><option value={2000}>2 kilometres</option><option value={5000}>5 kilometres</option></select></label><button className="primary-cta" disabled={saving} type="submit">Save watch area</button></form>{pushNotificationsSupported() && <button className="text-button watch-push-button" disabled={saving} onClick={() => void enablePush()} type="button"><Icon name="notification-3" />Turn on push notifications</button>}{status && <p className="watch-status" role="status">{status}</p>}{areas.length > 0 && <ul>{areas.map((area) => <li key={area.id}><span><strong>{area.label}</strong><small>{area.radius_metres >= 1000 ? `${area.radius_metres / 1000} km radius` : `${area.radius_metres} m radius`}</small></span><button onClick={() => void remove(area.id)} type="button">Remove</button></li>)}</ul>}</section>
}

function ConfirmedConversations({ matches }: { matches: FoundMatch[] }) {
  const [body, setBody] = useState('')
  const [sending, setSending] = useState<string | null>(null)
  if (!matches.length) return null
  async function send(reportId: string) { if (!supabase || !body.trim()) return; setSending(reportId); await supabase.rpc('send_found_pet_message', { target_report_id: reportId, message_body: body.trim() }); setBody(''); setSending(null) }
  return <section className="dashboard-empty"><h2>Private messages</h2><p>Write to a reporter after they sign in with their follow-up email.</p>{matches.map((match) => <div key={match.found_pet_report_id}><textarea aria-label="Message to reporter" maxLength={1500} onChange={(event) => setBody(event.target.value)} value={body} /><button className="primary-cta" disabled={sending === match.found_pet_report_id} onClick={() => void send(match.found_pet_report_id)} type="button">{sending ? 'Sending…' : 'Send message'}</button></div>)}</section>
}

function FoundMatchReview({ match, saving, onReview }: { match: FoundMatch, saving: boolean, onReview: (match: FoundMatch, decision: 'confirmed' | 'declined') => Promise<void> }) {
  const { t } = useTranslation()
  const [photoUrl, setPhotoUrl] = useState('')
  useEffect(() => { const path = match.report?.photo?.display_object_path; if (!supabase || !path) return; void supabase.storage.from('found-pet-photos').createSignedUrl(path, 60 * 10).then(({ data }) => setPhotoUrl(data?.signedUrl ?? '')) }, [match])
  return <div className="dashboard-page"><SiteHeader /><main className="dashboard-shell"><section className="found-owner-matches"><p className="eyebrow">Possible match</p><h1>Is this your pet?</h1><p>We matched an approved found-pet report to one of your active cases. Check the private details before deciding.</p><article>{photoUrl && <img src={photoUrl} alt="Private photo of the found pet" />}<strong>{[match.report?.colour, match.report?.breed].filter(Boolean).join(' · ') || 'Found pet'}</strong><span>{match.report?.details}</span><small>{match.match_reasons.join(' · ')}</small><p>{match.report?.location_description || 'Exact location available after confirmation.'}</p><div><button className="primary-cta" type="button" disabled={saving} onClick={() => void onReview(match, 'confirmed')}>{saving ? 'Saving…' : 'Yes, this is my pet'}</button><button className="secondary-button" type="button" disabled={saving} onClick={() => void onReview(match, 'declined')}>No, this is not my pet</button></div></article><Link className="text-button" to="/dashboard">{t('dashboard.title')}</Link></section></main><SiteFooter /></div>
}

function OwnerCaseCard({ caseData, photoUrl, sightings, matches, editing, locale, saving, onEdit, onCancel, onSave, onStatus, onRemove, onReviewSighting, onReviewFoundMatch }: { caseData: OwnerCase, photoUrl?: string, sightings: OwnerSighting[], matches: FoundMatch[], editing: boolean, locale: AppLocale, saving: boolean, onEdit: () => void, onCancel: () => void, onSave: (event: FormEvent<HTMLFormElement>, caseData: OwnerCase) => Promise<void>, onStatus: (caseData: OwnerCase, status: Extract<OwnerCaseStatus, 'published' | 'closed' | 'reunited'>, reunion?: { reason: NonNullable<OwnerCase['reunion_reason']>, attributed: boolean }) => Promise<void>, onRemove: (caseData: OwnerCase) => Promise<void>, onReviewSighting: (sighting: OwnerSighting, status: Exclude<SightingReportStatus, 'pending'>) => Promise<void>, onReviewFoundMatch: (match: FoundMatch, decision: 'confirmed' | 'declined') => Promise<void> }) {
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
  void matches
  void onReviewFoundMatch
  function submitReunion(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (attributed === null) return; void onStatus(caseData, 'reunited', { reason: reunionReason, attributed }).then(() => setReunionOpen(false)) }
  return <article className={`owner-case ${caseData.status}`}><PetImage className="owner-case-photo" petName={pet.name} species={pet.species} sourceUrl={photoUrl} /><div className="owner-case-body"><div className="owner-case-heading"><div><p className={`owner-status ${caseData.status}`}><span className="status-dot" />{t(`dashboard.status.${caseData.status}`)}{caseData.status === 'reunited' && <span className="reunion-emoji" aria-hidden="true">🎉</span>}</p><h2>{title}</h2></div>{active && <Link className="case-link" to={`/find/${caseData.public_slug}`}>{t('dashboard.viewPublic')}<Icon name="external-link" /></Link>}</div>{editing ? <form className="owner-edit-form" onSubmit={(event) => void onSave(event, caseData)}><label>{t('dashboard.caseTitle')}<input name="title" defaultValue={caseData.title ?? ''} maxLength={140} /></label><div className="two-columns"><label>{t('dashboard.petName')}<input name="name" defaultValue={pet.name} maxLength={80} required /></label><label>{t('dashboard.breed')}<input name="breed" defaultValue={pet.breed ?? ''} maxLength={120} /></label></div><label>{t('dashboard.colour')}<input name="colour" defaultValue={pet.colour ?? ''} maxLength={120} /></label><label>{t('dashboard.description')}<textarea name="description" defaultValue={pet.description ?? ''} maxLength={1500} rows={3} /></label><label>{t('dashboard.lastSeenPlace')}<input name="place" defaultValue={caseData.last_seen_description ?? ''} maxLength={1500} /></label><label>{t('dashboard.lastSeenTime')}<input name="lastSeenAt" defaultValue={dateTimeLocalValue(caseData.last_seen_at)} type="datetime-local" /></label><p className="form-privacy"><Icon name="shield-check" />{t('dashboard.locationNote')}</p><div className="owner-form-actions"><button className="primary-cta" disabled={saving} type="submit">{saving ? t('dashboard.saving') : t('dashboard.saveChanges')}</button><button className="text-button" type="button" onClick={onCancel}>{t('dashboard.cancel')}</button></div></form> : <><dl className="owner-case-details"><div><dt>{t('dashboard.pet')}</dt><dd>{pet.name} · {t(`common.${pet.species}`)}</dd></div><div><dt>{t('publicCase.lastSeen')}</dt><dd>{caseData.last_seen_at ? formatDateTime(caseData.last_seen_at, locale) : t('publicCase.lastSeenUnknown')}</dd></div></dl>{canManage ? <div className="owner-case-actions"><button className="secondary-button" type="button" onClick={onEdit}><Icon name="edit-line" />{t('dashboard.edit')}</button><label className="status-control">{t('dashboard.changeStatus')}<select aria-label={t('dashboard.changeStatus')} disabled={saving} value={caseData.status} onChange={(event) => { const status = event.target.value as Extract<OwnerCaseStatus, 'published' | 'closed'>; void onStatus(caseData, status) }}><option value="published">{t('dashboard.status.published')}</option><option value="closed">{t('dashboard.status.closed')}</option></select></label>{caseData.status === 'published' && <button className="reunited-button" type="button" onClick={() => setReunionOpen(true)}><Icon name="heart-3-line" />{t('dashboard.markReunited')}</button>}</div> : <p className="owner-case-closed">{caseData.status === 'reunited' ? t('dashboard.reunitedNote') : t('dashboard.closedNote')}</p>}{removeOpen ? <section className="remove-case" aria-labelledby={`remove-case-${caseData.id}`}><h3 id={`remove-case-${caseData.id}`}>{t('dashboard.removeTitle')}</h3><p>{t('dashboard.removeIntro')}</p><div className="owner-form-actions"><button className="danger-button" disabled={saving} type="button" onClick={() => void onRemove(caseData)}>{t('dashboard.confirmRemove')}</button><button className="text-button" disabled={saving} type="button" onClick={() => setRemoveOpen(false)}>{t('dashboard.cancel')}</button></div></section> : <button className="remove-case-button" disabled={saving} type="button" onClick={() => setRemoveOpen(true)}><Icon name="delete-bin-line" />{t('dashboard.remove')}</button>}{reunionOpen && <form className="reunion-form" onSubmit={submitReunion}><h3>{t('dashboard.reunionTitle')}</h3><p>{t('dashboard.reunionIntro')}</p><label>{t('dashboard.reunionReason')}<select value={reunionReason} onChange={(event) => setReunionReason(event.target.value as typeof reunionReason)}><option value="returned_home">{t('dashboard.reunionReasons.returned_home')}</option><option value="found_by_neighbour">{t('dashboard.reunionReasons.found_by_neighbour')}</option><option value="seen_after_report">{t('dashboard.reunionReasons.seen_after_report')}</option><option value="other">{t('dashboard.reunionReasons.other')}</option></select></label><fieldset><legend>{t('dashboard.petSeenHelped')}</legend><label><input checked={attributed === true} name={`attribution-${caseData.id}`} onChange={() => setAttributed(true)} type="radio" />{t('common.yes')}</label><label><input checked={attributed === false} name={`attribution-${caseData.id}`} onChange={() => setAttributed(false)} type="radio" />{t('common.no')}</label></fieldset><div className="owner-form-actions"><button className="primary-cta" disabled={saving || attributed === null} type="submit">{t('dashboard.confirmReunion')}</button><button className="text-button" type="button" onClick={() => setReunionOpen(false)}>{t('dashboard.cancel')}</button></div></form>}{sightings.length > 0 && <section className="sighting-timeline"><div><p className="eyebrow">{t('dashboard.sightings')}</p><h3>{t('dashboard.sightingTimeline')}</h3><p>{t('dashboard.sightingPrivacy')}</p></div><OwnerSightingMap points={sightings} /><ol>{sightings.map((sighting) => <li key={sighting.id}><strong>{formatDateTime(sighting.seen_at, locale)}</strong><span>{sighting.location_description || t('dashboard.coordinates')}</span>{sighting.details && <p>{sighting.details}</p>}<div className="sighting-review"><span className={`sighting-status ${sighting.report_status}`}>{t(`dashboard.sightingStatus.${sighting.report_status}`)}</span>{sighting.report_status === 'pending' && <div><button disabled={saving} onClick={() => void onReviewSighting(sighting, 'confirmed')} type="button">{t('dashboard.confirmSighting')}</button><button disabled={saving} onClick={() => void onReviewSighting(sighting, 'dismissed')} type="button">{t('dashboard.dismissSighting')}</button></div>}</div></li>)}</ol></section>}</>}</div></article>
}
