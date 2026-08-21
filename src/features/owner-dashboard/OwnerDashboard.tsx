import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { OwnerSightingMap } from '../../components/maps/OwnerSightingMap'
import { useAuth } from '../../auth/useAuth'
import { Icon } from '../../components/Icon'
import { PetImage } from '../../components/PetImage'
import { Link, SiteFooter, SiteHeader } from '../../components/SiteChrome'
import { formatDateTime } from '../../i18n/format'
import type { AppLocale } from '../../i18n/resources'
import { pushNotificationsSupported } from '../../lib/push-notifications'
import { getCurrentCoordinates } from '../../lib/geolocation'
import {
  signedFoundPetPhotoQuery,
  useOwnerDashboardQuery,
  useWatchAreasQuery,
} from '../../features/owner-dashboard/queries'
import { useOwnerMutations } from '../../features/owner-dashboard/mutations'
import type {
  FoundMatch,
  OwnerCase,
  OwnerCaseStatus,
  OwnerSighting,
} from '../../features/owner-dashboard/api'

type SightingReportStatus = 'pending' | 'confirmed' | 'dismissed'

function dateTimeLocalValue(value: string | null) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function OwnerDashboardPage() {
  const { t, i18n } = useTranslation()
  const { isLoading, session } = useAuth()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const dashboard = useOwnerDashboardQuery(session?.user.id)
  const mutations = useOwnerMutations(session?.user.id ?? '')
  const cases = dashboard.data?.cases ?? []
  const sightings = dashboard.data?.sightings ?? []
  const foundMatches = dashboard.data?.foundMatches ?? []

  async function saveCase(
    event: FormEvent<HTMLFormElement>,
    caseData: OwnerCase,
  ) {
    event.preventDefault()
    if (!session || !caseData.pet) {
      return
    }
    const fields = new FormData(event.currentTarget)
    setMessage('')
    try {
      await mutations.updateCase.mutateAsync({
        userId: session.user.id,
        caseId: caseData.id,
        petId: caseData.pet.id,
        fields: Object.fromEntries(fields) as Record<string, string>,
      })
      setEditingId(null)
      setMessage(t('dashboard.saved'))
    } catch {
      setMessage(t('dashboard.saveError'))
    }
  }

  async function changeStatus(
    caseData: OwnerCase,
    status: Extract<OwnerCaseStatus, 'published' | 'closed' | 'reunited'>,
    reunion?: {
      reason: NonNullable<OwnerCase['reunion_reason']>
      attributed: boolean
    },
  ) {
    if (!session) {
      return
    }
    setMessage('')
    try {
      await mutations.setStatus.mutateAsync({
        userId: session.user.id,
        caseId: caseData.id,
        status,
        publishedAt: caseData.published_at,
        reunion,
      })
      setMessage(t('dashboard.statusSaved'))
    } catch {
      setMessage(t('dashboard.statusError'))
    }
  }

  async function removeCase(caseData: OwnerCase) {
    if (!session) {
      return
    }
    setMessage('')
    try {
      await mutations.deleteCase.mutateAsync({
        userId: session.user.id,
        caseId: caseData.id,
      })
      setEditingId(null)
      setMessage(t('dashboard.removed'))
    } catch {
      setMessage(t('dashboard.removeError'))
    }
  }

  if (isLoading) {
    return (
      <main className="dashboard-shell">
        <p>{t('auth.loading')}</p>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="dashboard-shell">
        <section className="auth-card">
          <p className="eyebrow">{t('dashboard.eyebrow')}</p>
          <h1>{t('dashboard.signInTitle')}</h1>
          <p>{t('dashboard.signInBody')}</p>
          <Link className="primary-cta" to="/auth">
            {t('common.signIn')}
            <Icon name="arrow-right" />
          </Link>
        </section>
      </main>
    )
  }
  async function reviewSighting(
    sighting: OwnerSighting,
    status: Exclude<SightingReportStatus, 'pending'>,
  ) {
    setMessage('')
    try {
      await mutations.reviewSighting.mutateAsync({
        sightingId: sighting.id,
        status,
      })
      setMessage(t('dashboard.sightingStatusSaved'))
    } catch {
      setMessage(t('dashboard.sightingStatusError'))
    }
  }
  async function reviewFoundMatch(
    match: FoundMatch,
    decision: 'confirmed' | 'declined',
  ) {
    setMessage('')
    try {
      await mutations.reviewFoundMatch.mutateAsync({
        reportId: match.found_pet_report_id,
        caseId: match.case_id,
        decision,
      })
      setMessage(
        decision === 'confirmed'
          ? 'Found-pet match confirmed.'
          : 'Found-pet match declined.',
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'We could not update this match.',
      )
    }
  }

  const pendingFoundMatch = foundMatches.find(
    (match) => match.status === 'pending_owner',
  )
  if (pendingFoundMatch) {
    return (
      <FoundMatchReview
        match={pendingFoundMatch}
        saving={mutations.reviewFoundMatch.isPending}
        onReview={reviewFoundMatch}
      />
    )
  }

  return (
    <div className="dashboard-page">
      <SiteHeader />
      <main className="dashboard-shell">
        <div className="dashboard-intro">
          <div>
            <p className="eyebrow">{t('dashboard.eyebrow')}</p>
            <h1>{t('dashboard.title')}</h1>
            <p>{t('dashboard.intro')}</p>
          </div>
          {cases.length > 0 && (
            <Link className="secondary-button dashboard-new" to="/lost/new">
              <Icon name="add-line" />
              {t('dashboard.newCase')}
            </Link>
          )}
        </div>
        {message && (
          <p className="dashboard-message" role="status">
            {message}
          </p>
        )}
        {dashboard.isLoading ? (
          <p>{t('dashboard.loading')}</p>
        ) : dashboard.isError ? (
          <p className="form-error">{t('dashboard.loadError')}</p>
        ) : cases.length === 0 ? (
          <section className="dashboard-empty">
            <h2>{t('dashboard.emptyTitle')}</h2>
            <p>{t('dashboard.emptyBody')}</p>
            <Link className="primary-cta" to="/lost/new">
              {t('dashboard.newCase')}
              <Icon name="arrow-right" />
            </Link>
          </section>
        ) : (
          <>
            <div className="case-list">
              {cases.map((caseData) => (
                <OwnerCaseCard
                  key={caseData.id}
                  caseData={caseData}
                  sightings={sightings.filter(
                    (sighting) => sighting.case_id === caseData.id,
                  )}
                  matches={foundMatches.filter(
                    (match) => match.case_id === caseData.id,
                  )}
                  editing={editingId === caseData.id}
                  locale={i18n.resolvedLanguage as AppLocale}
                  saving={
                    mutations.updateCase.isPending ||
                    mutations.setStatus.isPending ||
                    mutations.deleteCase.isPending ||
                    mutations.reviewSighting.isPending ||
                    mutations.reviewFoundMatch.isPending
                  }
                  onEdit={() => setEditingId(caseData.id)}
                  onCancel={() => setEditingId(null)}
                  onSave={saveCase}
                  onStatus={changeStatus}
                  onRemove={removeCase}
                  onReviewSighting={reviewSighting}
                  onReviewFoundMatch={reviewFoundMatch}
                />
              ))}
            </div>
            <ConfirmedConversations
              matches={foundMatches.filter(
                (match) => match.status === 'confirmed',
              )}
            />
          </>
        )}
        <WatchAreas sessionUserId={session.user.id} />
      </main>
      <SiteFooter />
    </div>
  )
}

function WatchAreas({ sessionUserId }: { sessionUserId: string }) {
  const [label, setLabel] = useState(''),
    [radius, setRadius] = useState(2000),
    [position, setPosition] = useState<{
      latitude: number
      longitude: number
    } | null>(null),
    [status, setStatus] = useState('')
  const configuredVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as
    string | undefined
  const areasQuery = useWatchAreasQuery(sessionUserId)
  const mutations = useOwnerMutations(sessionUserId)
  const areas = areasQuery.data ?? []
  const saving =
    mutations.createWatchArea.isPending ||
    mutations.deleteWatchArea.isPending ||
    mutations.enablePush.isPending
  async function useLocation() {
    setStatus('')
    const result = await getCurrentCoordinates({
      maximumAge: 60_000,
      timeout: 15_000,
    })
    if (!result.ok) {
      setStatus(
        result.reason === 'unavailable'
          ? 'Your browser cannot provide a location.'
          : 'We could not access your location. Check your browser permission and try again.',
      )
      return
    }
    setPosition(result.coordinates)
    setStatus('Location selected. Give this area a name before saving.')
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!position || !label.trim()) {
      setStatus('Choose your location and enter an area name first.')
      return
    }
    setStatus('')
    try {
      await mutations.createWatchArea.mutateAsync({
        userId: sessionUserId,
        label: label.trim(),
        radius,
        ...position,
      })
      setLabel('')
      setPosition(null)
      setStatus('Watch area saved. We will alert you about new reports nearby.')
    } catch {
      setStatus('We could not save that watch area. Please try again.')
    }
  }
  async function enablePush() {
    setStatus('')
    try {
      await mutations.enablePush.mutateAsync(configuredVapidKey ?? '')
      setStatus('Push notifications are on for this browser.')
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : 'We could not enable push notifications.',
      )
    }
  }
  async function remove(id: string) {
    try {
      await mutations.deleteWatchArea.mutateAsync(id)
    } catch {
      setStatus('We could not remove that watch area. Please try again.')
    }
  }
  return (
    <details className="watch-areas">
      <summary>
        <span>
          <strong>Local alerts</strong>
          <small>Get notified about reports near an area.</small>
        </span>
        <Icon name="arrow-down-s" />
      </summary>
      <div className="watch-areas-content">
        <p>
          Use your current location to set the area, then choose an alert radius
          and a private name for it. Alerts never include the exact location;
          email is used if push cannot reach this browser.
        </p>
        <form onSubmit={(event) => void save(event)}>
          <button
            className="secondary-button"
            onClick={useLocation}
            type="button"
          >
            <Icon name="map-pin-user" />
            {position ? 'Current location selected' : 'Use current location'}
          </button>
          <label>
            Name this saved location
            <input
              maxLength={100}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="e.g. Home"
              value={label}
            />
          </label>
          <label>
            Alert radius
            <select
              onChange={(event) => setRadius(Number(event.target.value))}
              value={radius}
            >
              <option value={500}>500 metres</option>
              <option value={1000}>1 kilometre</option>
              <option value={2000}>2 kilometres</option>
              <option value={5000}>5 kilometres</option>
            </select>
          </label>
          <button className="primary-cta" disabled={saving} type="submit">
            Save watch area
          </button>
        </form>
        {pushNotificationsSupported() && (
          <button
            className="text-button watch-push-button"
            disabled={saving}
            onClick={() => void enablePush()}
            type="button"
          >
            <Icon name="notification-3" />
            Turn on push notifications
          </button>
        )}
        {status && (
          <p className="watch-status" role="status">
            {status}
          </p>
        )}
        {areas.length > 0 && (
          <ul>
            {areas.map((area) => (
              <li key={area.id}>
                <span>
                  <strong>{area.label}</strong>
                  <small>
                    {area.radius_metres >= 1000
                      ? `${area.radius_metres / 1000} km radius`
                      : `${area.radius_metres} m radius`}
                  </small>
                </span>
                <button onClick={() => void remove(area.id)} type="button">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  )
}

function ConfirmedConversations({ matches }: { matches: FoundMatch[] }) {
  const [body, setBody] = useState('')
  const { session } = useAuth()
  const mutations = useOwnerMutations(session?.user.id ?? '')
  if (!matches.length) return null
  async function send(reportId: string) {
    if (!body.trim()) return
    await mutations.sendMessage.mutateAsync({ reportId, body: body.trim() })
    setBody('')
  }
  return (
    <section className="dashboard-empty">
      <h2>Private messages</h2>
      <p>Write to a reporter after they sign in with their follow-up email.</p>
      {matches.map((match) => (
        <div key={match.found_pet_report_id}>
          <textarea
            aria-label="Message to reporter"
            maxLength={1500}
            onChange={(event) => setBody(event.target.value)}
            value={body}
          />
          <button
            className="primary-cta"
            disabled={mutations.sendMessage.isPending}
            onClick={() => void send(match.found_pet_report_id)}
            type="button"
          >
            {mutations.sendMessage.isPending ? 'Sending…' : 'Send message'}
          </button>
        </div>
      ))}
    </section>
  )
}

function FoundMatchReview({
  match,
  saving,
  onReview,
}: {
  match: FoundMatch
  saving: boolean
  onReview: (
    match: FoundMatch,
    decision: 'confirmed' | 'declined',
  ) => Promise<void>
}) {
  const { t } = useTranslation()
  const path = match.report?.photo?.display_object_path
  const photo = useQuery({
    ...signedFoundPetPhotoQuery(path ?? ''),
    enabled: Boolean(path),
  })
  const photoUrl = photo.data ?? ''
  const reportSummary =
    [match.report?.colour, match.report?.breed].filter(Boolean).join(' · ') ||
    'Found pet'
  return (
    <div className="dashboard-page">
      <SiteHeader />
      <main className="dashboard-shell">
        <section
          className="found-owner-matches"
          aria-labelledby="found-match-title"
        >
          <div className="found-owner-match-intro">
            <p className="eyebrow">Possible match</p>
            <h1 id="found-match-title">Is this your pet?</h1>
            <p>
              We matched an approved found-pet report to one of your active
              cases. Check the private details before deciding.
            </p>
          </div>
          <article className="found-owner-match-card">
            <div className="found-owner-match-photo">
              {photoUrl ? (
                <img src={photoUrl} alt="Private photo of the found pet" />
              ) : (
                <div className="found-owner-match-no-photo">
                  <Icon name="image-line" />
                  <span>No photo was provided</span>
                </div>
              )}
            </div>
            <div className="found-owner-match-details">
              <p className="found-owner-match-label">Found pet</p>
              <h2>{reportSummary}</h2>
              {match.report?.details && (
                <p className="found-owner-match-description">
                  {match.report.details}
                </p>
              )}
              <dl>
                <div>
                  <dt>Why it may be a match</dt>
                  <dd>{match.match_reasons.join(' · ')}</dd>
                </div>
                <div>
                  <dt>Found near</dt>
                  <dd>
                    {match.report?.location_description ||
                      'Exact location available after confirmation.'}
                  </dd>
                </div>
              </dl>
              <div className="found-owner-match-actions">
                <button
                  className="primary-cta"
                  type="button"
                  disabled={saving}
                  onClick={() => void onReview(match, 'confirmed')}
                >
                  {saving ? 'Saving…' : 'Yes, this is my pet'}
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={saving}
                  onClick={() => void onReview(match, 'declined')}
                >
                  No, this is not my pet
                </button>
              </div>
            </div>
          </article>
          <Link className="text-button found-owner-match-back" to="/dashboard">
            {t('dashboard.title')}
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}

function OwnerCaseCard({
  caseData,
  photoUrl,
  sightings,
  matches,
  editing,
  locale,
  saving,
  onEdit,
  onCancel,
  onSave,
  onStatus,
  onRemove,
  onReviewSighting,
  onReviewFoundMatch,
}: {
  caseData: OwnerCase
  photoUrl?: string
  sightings: OwnerSighting[]
  matches: FoundMatch[]
  editing: boolean
  locale: AppLocale
  saving: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (
    event: FormEvent<HTMLFormElement>,
    caseData: OwnerCase,
  ) => Promise<void>
  onStatus: (
    caseData: OwnerCase,
    status: Extract<OwnerCaseStatus, 'published' | 'closed' | 'reunited'>,
    reunion?: {
      reason: NonNullable<OwnerCase['reunion_reason']>
      attributed: boolean
    },
  ) => Promise<void>
  onRemove: (caseData: OwnerCase) => Promise<void>
  onReviewSighting: (
    sighting: OwnerSighting,
    status: Exclude<SightingReportStatus, 'pending'>,
  ) => Promise<void>
  onReviewFoundMatch: (
    match: FoundMatch,
    decision: 'confirmed' | 'declined',
  ) => Promise<void>
}) {
  const { t } = useTranslation()
  const pet = caseData.pet
  const [reunionOpen, setReunionOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [reunionReason, setReunionReason] =
    useState<NonNullable<OwnerCase['reunion_reason']>>('returned_home')
  const [attributed, setAttributed] = useState<boolean | null>(null)
  if (!pet) return null
  const active = caseData.status === 'published'
  const canManage = ['published', 'closed', 'reunited'].includes(
    caseData.status,
  )
  const title = caseData.title || t('publicCase.title', { petName: pet.name })
  void matches
  void onReviewFoundMatch
  function submitReunion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (attributed === null) return
    void onStatus(caseData, 'reunited', {
      reason: reunionReason,
      attributed,
    }).then(() => setReunionOpen(false))
  }
  return (
    <article className={`owner-case ${caseData.status}`}>
      <PetImage
        className="owner-case-photo"
        petName={pet.name}
        species={pet.species}
        sourceUrl={photoUrl}
      />
      <div className="owner-case-body">
        <div className="owner-case-heading">
          <div>
            <p className={`owner-status ${caseData.status}`}>
              <span className="status-dot" />
              {t(`dashboard.status.${caseData.status}`)}
              {caseData.status === 'reunited' && (
                <span className="reunion-emoji" aria-hidden="true">
                  🎉
                </span>
              )}
            </p>
            <h2>{title}</h2>
          </div>
          {active && (
            <Link className="case-link" to={`/find/${caseData.public_slug}`}>
              {t('dashboard.viewPublic')}
              <Icon name="external-link" />
            </Link>
          )}
        </div>
        {editing ? (
          <form
            className="owner-edit-form"
            onSubmit={(event) => void onSave(event, caseData)}
          >
            <label>
              {t('dashboard.caseTitle')}
              <input
                name="title"
                defaultValue={caseData.title ?? ''}
                maxLength={140}
              />
            </label>
            <div className="two-columns">
              <label>
                {t('dashboard.petName')}
                <input
                  name="name"
                  defaultValue={pet.name}
                  maxLength={80}
                  required
                />
              </label>
              <label>
                {t('dashboard.breed')}
                <input
                  name="breed"
                  defaultValue={pet.breed ?? ''}
                  maxLength={120}
                />
              </label>
            </div>
            <label>
              {t('dashboard.colour')}
              <input
                name="colour"
                defaultValue={pet.colour ?? ''}
                maxLength={120}
              />
            </label>
            <label>
              {t('dashboard.description')}
              <textarea
                name="description"
                defaultValue={pet.description ?? ''}
                maxLength={1500}
                rows={3}
              />
            </label>
            <label>
              {t('dashboard.lastSeenPlace')}
              <input
                name="place"
                defaultValue={caseData.last_seen_description ?? ''}
                maxLength={1500}
              />
            </label>
            <label>
              {t('dashboard.lastSeenTime')}
              <input
                name="lastSeenAt"
                defaultValue={dateTimeLocalValue(caseData.last_seen_at)}
                type="datetime-local"
              />
            </label>
            <p className="form-privacy">
              <Icon name="shield-check" />
              {t('dashboard.locationNote')}
            </p>
            <div className="owner-form-actions">
              <button className="primary-cta" disabled={saving} type="submit">
                {saving ? t('dashboard.saving') : t('dashboard.saveChanges')}
              </button>
              <button className="text-button" type="button" onClick={onCancel}>
                {t('dashboard.cancel')}
              </button>
            </div>
          </form>
        ) : (
          <>
            <dl className="owner-case-details">
              <div>
                <dt>{t('dashboard.pet')}</dt>
                <dd>
                  {pet.name} · {t(`common.${pet.species}`)}
                </dd>
              </div>
              <div>
                <dt>{t('publicCase.lastSeen')}</dt>
                <dd>
                  {caseData.last_seen_at
                    ? formatDateTime(caseData.last_seen_at, locale)
                    : t('publicCase.lastSeenUnknown')}
                </dd>
              </div>
            </dl>
            {canManage ? (
              <div className="owner-case-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={onEdit}
                >
                  <Icon name="edit-line" />
                  {t('dashboard.edit')}
                </button>
                <label className="status-control">
                  {t('dashboard.changeStatus')}
                  <select
                    aria-label={t('dashboard.changeStatus')}
                    disabled={saving}
                    value={caseData.status}
                    onChange={(event) => {
                      const status = event.target.value as Extract<
                        OwnerCaseStatus,
                        'published' | 'closed'
                      >
                      void onStatus(caseData, status)
                    }}
                  >
                    <option value="published">
                      {t('dashboard.status.published')}
                    </option>
                    <option value="closed">
                      {t('dashboard.status.closed')}
                    </option>
                  </select>
                </label>
                {caseData.status === 'published' && (
                  <button
                    className="reunited-button"
                    type="button"
                    onClick={() => setReunionOpen(true)}
                  >
                    <Icon name="heart-3-line" />
                    {t('dashboard.markReunited')}
                  </button>
                )}
              </div>
            ) : (
              <p className="owner-case-closed">
                {caseData.status === 'reunited'
                  ? t('dashboard.reunitedNote')
                  : t('dashboard.closedNote')}
              </p>
            )}
            {removeOpen ? (
              <section
                className="remove-case"
                aria-labelledby={`remove-case-${caseData.id}`}
              >
                <h3 id={`remove-case-${caseData.id}`}>
                  {t('dashboard.removeTitle')}
                </h3>
                <p>{t('dashboard.removeIntro')}</p>
                <div className="owner-form-actions">
                  <button
                    className="danger-button"
                    disabled={saving}
                    type="button"
                    onClick={() => void onRemove(caseData)}
                  >
                    {t('dashboard.confirmRemove')}
                  </button>
                  <button
                    className="text-button"
                    disabled={saving}
                    type="button"
                    onClick={() => setRemoveOpen(false)}
                  >
                    {t('dashboard.cancel')}
                  </button>
                </div>
              </section>
            ) : (
              <button
                className="remove-case-button"
                disabled={saving}
                type="button"
                onClick={() => setRemoveOpen(true)}
              >
                <Icon name="delete-bin-line" />
                {t('dashboard.remove')}
              </button>
            )}
            {reunionOpen && (
              <form className="reunion-form" onSubmit={submitReunion}>
                <h3>{t('dashboard.reunionTitle')}</h3>
                <p>{t('dashboard.reunionIntro')}</p>
                <label>
                  {t('dashboard.reunionReason')}
                  <select
                    value={reunionReason}
                    onChange={(event) =>
                      setReunionReason(
                        event.target.value as typeof reunionReason,
                      )
                    }
                  >
                    <option value="returned_home">
                      {t('dashboard.reunionReasons.returned_home')}
                    </option>
                    <option value="found_by_neighbour">
                      {t('dashboard.reunionReasons.found_by_neighbour')}
                    </option>
                    <option value="seen_after_report">
                      {t('dashboard.reunionReasons.seen_after_report')}
                    </option>
                    <option value="other">
                      {t('dashboard.reunionReasons.other')}
                    </option>
                  </select>
                </label>
                <fieldset>
                  <legend>{t('dashboard.petSeenHelped')}</legend>
                  <label>
                    <input
                      checked={attributed === true}
                      name={`attribution-${caseData.id}`}
                      onChange={() => setAttributed(true)}
                      type="radio"
                    />
                    {t('common.yes')}
                  </label>
                  <label>
                    <input
                      checked={attributed === false}
                      name={`attribution-${caseData.id}`}
                      onChange={() => setAttributed(false)}
                      type="radio"
                    />
                    {t('common.no')}
                  </label>
                </fieldset>
                <div className="owner-form-actions">
                  <button
                    className="primary-cta"
                    disabled={saving || attributed === null}
                    type="submit"
                  >
                    {t('dashboard.confirmReunion')}
                  </button>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => setReunionOpen(false)}
                  >
                    {t('dashboard.cancel')}
                  </button>
                </div>
              </form>
            )}
            {sightings.length > 0 && (
              <section className="sighting-timeline">
                <div>
                  <p className="eyebrow">{t('dashboard.sightings')}</p>
                  <h3>{t('dashboard.sightingTimeline')}</h3>
                  <p>{t('dashboard.sightingPrivacy')}</p>
                </div>
                <OwnerSightingMap points={sightings} />
                <ol>
                  {sightings.map((sighting) => (
                    <li key={sighting.id}>
                      <strong>
                        {formatDateTime(sighting.seen_at, locale)}
                      </strong>
                      <span>
                        {sighting.location_description ||
                          t('dashboard.coordinates')}
                      </span>
                      {sighting.details && <p>{sighting.details}</p>}
                      <div className="sighting-review">
                        <span
                          className={`sighting-status ${sighting.report_status}`}
                        >
                          {t(
                            `dashboard.sightingStatus.${sighting.report_status}`,
                          )}
                        </span>
                        {sighting.report_status === 'pending' && (
                          <div>
                            <button
                              disabled={saving}
                              onClick={() =>
                                void onReviewSighting(sighting, 'confirmed')
                              }
                              type="button"
                            >
                              {t('dashboard.confirmSighting')}
                            </button>
                            <button
                              disabled={saving}
                              onClick={() =>
                                void onReviewSighting(sighting, 'dismissed')
                              }
                              type="button"
                            >
                              {t('dashboard.dismissSighting')}
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </>
        )}
      </div>
    </article>
  )
}
