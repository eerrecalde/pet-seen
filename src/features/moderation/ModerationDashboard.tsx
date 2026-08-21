import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth/useAuth'
import { Icon } from '../../components/Icon'
import { Link, SiteFooter, SiteHeader } from '../../components/SiteChrome'
import { formatDateTime } from '../../i18n/format'
import type { AppLocale } from '../../i18n/resources'
import { moderationApi } from '../../features/moderation/api'
import { useSignedPhotoUrls } from '../../hooks/useSignedPhotoUrls'

type ContentReportStatus = 'open' | 'reviewed' | 'dismissed' | 'actioned'
type ModerationReport = {
  id: string
  reason: 'incorrect' | 'harmful' | 'scam' | 'other'
  details: string | null
  status: ContentReportStatus
  created_at: string
  case: {
    public_slug: string
    title: string | null
    pet: { name: string } | null
  } | null
}
type AiCandidateScore = {
  case_id: string
  deterministic_score: number
  ai_similarity_score: number
  combined_score: number
  confidence: 'low' | 'medium' | 'high'
  explanation: string
  priority_review: boolean
  created_at: string
}
type FoundPetReport = {
  id: string
  species: 'dog' | 'cat'
  breed: string | null
  colour: string | null
  details: string
  custody_status: 'with_reporter' | 'with_vet_or_rescue' | 'not_in_custody'
  location_description: string | null
  found_at: string
  created_at: string
  moderation_status: 'pending' | 'approved' | 'rejected'
  lifecycle_status: 'active' | 'resolved' | 'expired'
  lifecycle_reason: string | null
  automated_screening_note: string | null
  photo: {
    source_object_path: string
    display_object_path: string | null
  } | null
  link: {
    case_id: string
    status: 'pending_owner' | 'confirmed' | 'declined'
    case: { public_slug: string; pet: { name: string } | null } | null
  } | null
  ai_scores: AiCandidateScore[]
}
type UnlinkedSighting = {
  id: string
  seen_at: string
  location_description: string | null
  details: string
  ai_scores: AiCandidateScore[]
}
type MatchCandidate = {
  case_id: string
  public_slug: string
  pet_name: string
  breed: string | null
  colour: string | null
  last_seen_at: string | null
  distance_km: number
  match_score: number
  match_reasons: string[]
}

export function ModerationPage() {
  const { t, i18n } = useTranslation()
  const { isLoading, session } = useAuth()
  const [access, setAccess] = useState<'checking' | 'allowed' | 'denied'>(
    'checking',
  )
  const [reports, setReports] = useState<ModerationReport[]>([])
  const [foundReports, setFoundReports] = useState<FoundPetReport[]>([])
  const [unlinkedSightings, setUnlinkedSightings] = useState<
    UnlinkedSighting[]
  >([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [housekeeping, setHousekeeping] = useState<
    'idle' | 'running' | 'error'
  >('idle')
  const loadReports = useCallback(async () => {
    setState('loading')
    try {
      const data = await moderationApi.load()
      setReports(
        (data.content ?? []).map((report) => {
          const caseData = Array.isArray(report.case)
            ? (report.case[0] ?? null)
            : report.case
          return {
            ...report,
            case: caseData
              ? {
                  ...caseData,
                  pet: Array.isArray(caseData.pet)
                    ? (caseData.pet[0] ?? null)
                    : caseData.pet,
                }
              : null,
          }
        }) as unknown as ModerationReport[],
      )
      setFoundReports(
        (data.found ?? []).map((report) => {
          const link = Array.isArray(report.link)
            ? (report.link[0] ?? null)
            : report.link
          const photo = Array.isArray(report.photo)
            ? (report.photo[0] ?? null)
            : report.photo
          return {
            ...report,
            photo,
            ai_scores: (report.ai_scores ?? []).sort((a, b) =>
              b.created_at.localeCompare(a.created_at),
            ),
            link: link
              ? {
                  ...link,
                  case: Array.isArray(link.case)
                    ? (link.case[0] ?? null)
                    : link.case,
                }
              : null,
          }
        }) as unknown as FoundPetReport[],
      )
      setUnlinkedSightings(
        (data.sightings ?? []).map((sighting) => ({
          ...sighting,
          ai_scores: (sighting.ai_scores ?? []).sort((a, b) =>
            b.created_at.localeCompare(a.created_at),
          ),
        })) as UnlinkedSighting[],
      )
      setState('ready')
    } catch {
      setState('error')
    }
  }, [])
  useEffect(() => {
    if (!session) {
      setAccess('denied')
      return
    }
    void moderationApi
      .isAuthorized()
      .then((data) => {
        const allowed = data === true
        setAccess(allowed ? 'allowed' : 'denied')
        if (allowed) void loadReports()
      })
      .catch(() => setAccess('denied'))
  }, [loadReports, session])
  async function updateStatus(
    report: ModerationReport,
    status: ContentReportStatus,
  ) {
    setSavingId(report.id)
    try {
      await moderationApi.updateContentStatus(report.id, status)
      await loadReports()
    } finally {
      setSavingId(null)
    }
  }
  async function runHousekeeping() {
    setHousekeeping('running')
    try {
      await moderationApi.housekeeping()
      setHousekeeping('idle')
      await loadReports()
    } catch {
      setHousekeeping('error')
    }
  }
  if (isLoading || access === 'checking') {
    return (
      <main className="moderation-shell">
        <p>{t('moderation.checking')}</p>
      </main>
    )
  }

  if (access === 'denied') {
    return (
      <main className="moderation-shell">
        <section className="auth-card">
          <p className="eyebrow">{t('moderation.eyebrow')}</p>
          <h1>{t('moderation.deniedTitle')}</h1>
          <p>{t('moderation.deniedBody')}</p>
          <Link className="primary-cta" to={session ? '/' : '/auth'}>
            {session ? t('common.backToHome') : t('common.signIn')}
            <Icon name="arrow-right" />
          </Link>
        </section>
      </main>
    )
  }
  return (
    <div className="moderation-page">
      <SiteHeader />
      <main className="moderation-shell">
        <section className="moderation-intro">
          <p className="eyebrow">{t('moderation.eyebrow')}</p>
          <h1>{t('moderation.title')}</h1>
          <p>{t('moderation.intro')}</p>
          <button
            className="secondary-button housekeeping-button"
            type="button"
            disabled={housekeeping === 'running'}
            onClick={() => void runHousekeeping()}
          >
            {housekeeping === 'running'
              ? t('moderation.runningHousekeeping')
              : t('moderation.runHousekeeping')}
          </button>
          {housekeeping === 'error' && (
            <p className="form-error">{t('moderation.housekeepingError')}</p>
          )}
        </section>
        {state === 'loading' ? (
          <p>{t('moderation.loading')}</p>
        ) : state === 'error' ? (
          <p className="form-error">{t('moderation.error')}</p>
        ) : (
          <>
            <FoundPetMatches
              reports={foundReports}
              locale={i18n.resolvedLanguage as AppLocale}
              onLinked={loadReports}
            />
            <UnlinkedSightingMatches
              sightings={unlinkedSightings}
              locale={i18n.resolvedLanguage as AppLocale}
              onLinked={loadReports}
            />
            <section className="moderation-content-reports">
              <h2>{t('moderation.contentReports')}</h2>
              {reports.length === 0 ? (
                <section className="dashboard-empty">
                  <h3>{t('moderation.emptyTitle')}</h3>
                  <p>{t('moderation.emptyBody')}</p>
                </section>
              ) : (
                <div className="moderation-list">
                  {reports.map((report) => (
                    <article className="moderation-report" key={report.id}>
                      <div>
                        <p className={`moderation-status ${report.status}`}>
                          {t(`moderation.status.${report.status}`)}
                        </p>
                        <h3>
                          {report.case?.title ||
                            (report.case?.pet?.name
                              ? t('publicCase.title', {
                                  petName: report.case.pet.name,
                                })
                              : t('moderation.unavailableCase'))}
                        </h3>
                        <p className="report-meta">
                          {t(`contentReport.reasons.${report.reason}`)} ·{' '}
                          {formatDateTime(
                            report.created_at,
                            i18n.resolvedLanguage as AppLocale,
                          )}
                        </p>
                        {report.details && (
                          <p className="report-details">{report.details}</p>
                        )}
                        {report.case && (
                          <Link
                            className="case-link"
                            to={`/find/${report.case.public_slug}`}
                          >
                            {t('moderation.viewCase')}
                            <Icon name="external-link" />
                          </Link>
                        )}
                      </div>
                      <label className="status-control">
                        {t('moderation.statusLabel')}
                        <select
                          aria-label={t('moderation.statusLabel')}
                          disabled={savingId === report.id}
                          value={report.status}
                          onChange={(event) =>
                            void updateStatus(
                              report,
                              event.target.value as ContentReportStatus,
                            )
                          }
                        >
                          <option value="open">
                            {t('moderation.status.open')}
                          </option>
                          <option value="reviewed">
                            {t('moderation.status.reviewed')}
                          </option>
                          <option value="dismissed">
                            {t('moderation.status.dismissed')}
                          </option>
                          <option value="actioned">
                            {t('moderation.status.actioned')}
                          </option>
                        </select>
                      </label>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}

function UnlinkedSightingMatches({
  sightings,
  locale,
  onLinked,
}: {
  sightings: UnlinkedSighting[]
  locale: AppLocale
  onLinked: () => Promise<void>
}) {
  const [candidates, setCandidates] = useState<
    Record<string, MatchCandidate[]>
  >({})
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [analysingId, setAnalysingId] = useState<string | null>(null)
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  async function showCandidates(sightingId: string) {
    if (candidates[sightingId]) return
    setLoadingId(sightingId)
    try {
      const result = await moderationApi.sightingCandidates(sightingId)
      setCandidates((current) => ({
        ...current,
        [sightingId]: (result ?? []) as MatchCandidate[],
      }))
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'We could not find candidates.',
      )
    } finally {
      setLoadingId(null)
    }
  }
  async function analyse(sightingId: string) {
    setAnalysingId(sightingId)
    setError('')
    try {
      await moderationApi.scoreSighting(sightingId)
      await onLinked()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'We could not analyse this sighting.',
      )
    } finally {
      setAnalysingId(null)
    }
  }
  async function link(sightingId: string, caseId: string) {
    setLinkingId(`${sightingId}-${caseId}`)
    try {
      await moderationApi.linkSighting(sightingId, caseId)
      await onLinked()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'We could not link this sighting.',
      )
    } finally {
      setLinkingId(null)
    }
  }
  return (
    <section
      className="found-match-section unlinked-sighting-section"
      aria-labelledby="unlinked-sightings-title"
    >
      <div className="found-match-heading">
        <div>
          <h2 id="unlinked-sightings-title">Unlinked sightings</h2>
          <p>
            Review nearby cases before running the AI description analysis.
            Scores guide your review; staff can link any listed candidate and
            notify its owner.
          </p>
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
      {sightings.length === 0 ? (
        <section className="dashboard-empty">
          <h3>No unlinked sightings</h3>
          <p>
            New reports without a selected case will appear here for staff
            review.
          </p>
        </section>
      ) : (
        <div className="found-match-list">
          {sightings.map((sighting) => (
            <article className="found-match-card" key={sighting.id}>
              <div>
                <p className="moderation-status">
                  Reported · {formatDateTime(sighting.seen_at, locale)}
                </p>
                <h3>
                  {sighting.location_description || 'Location shared privately'}
                </h3>
                <p>{sighting.details}</p>
              </div>
              <div className="found-match-actions">
                <button
                  className="secondary-button"
                  type="button"
                  disabled={loadingId === sighting.id}
                  onClick={() => void showCandidates(sighting.id)}
                >
                  {loadingId === sighting.id
                    ? 'Finding nearby cases…'
                    : 'Find nearby cases'}
                </button>
                {candidates[sighting.id] && (
                  <>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={analysingId === sighting.id}
                      onClick={() => void analyse(sighting.id)}
                    >
                      {analysingId === sighting.id
                        ? 'Analysing description…'
                        : 'Run AI analysis'}
                    </button>
                    <p className="ai-review-note">
                      AI results are staff-only guidance. You decide whether to
                      link a listed candidate.
                    </p>
                    <SightingCandidateList
                      candidates={candidates[sighting.id]}
                      scores={sighting.ai_scores}
                      sightingId={sighting.id}
                      linkingId={linkingId}
                      locale={locale}
                      onLink={link}
                    />
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function SightingCandidateList({
  candidates,
  scores,
  sightingId,
  linkingId,
  locale,
  onLink,
}: {
  candidates: MatchCandidate[]
  scores: AiCandidateScore[]
  sightingId: string
  linkingId: string | null
  locale: AppLocale
  onLink: (sightingId: string, caseId: string) => Promise<void>
}) {
  if (!candidates.length)
    return (
      <p className="found-match-none">No nearby active cases were found.</p>
    )
  return (
    <ol className="candidate-list">
      {candidates.map((candidate) => {
        const ai = scores.find((score) => score.case_id === candidate.case_id)
        return (
          <li key={candidate.case_id}>
            <div>
              <strong>{candidate.pet_name}</strong>
              <span>
                {[candidate.colour, candidate.breed]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              <small>
                {candidate.distance_km} km ·{' '}
                {candidate.last_seen_at
                  ? formatDateTime(candidate.last_seen_at, locale)
                  : 'Last seen time unavailable'}
              </small>
              <p>{candidate.match_reasons.join(' · ')}</p>
              {ai && (
                <div className="ai-candidate-score">
                  <strong>
                    {ai.priority_review
                      ? 'Priority staff review'
                      : 'AI review result'}
                  </strong>
                  <span>
                    AI similarity {ai.ai_similarity_score} · combined{' '}
                    {ai.combined_score} · {ai.confidence} confidence
                  </span>
                  <p>{ai.explanation}</p>
                </div>
              )}
            </div>
            <div className="candidate-action">
              <b>{candidate.match_score}</b>
              <button
                type="button"
                disabled={linkingId === `${sightingId}-${candidate.case_id}`}
                onClick={() => void onLink(sightingId, candidate.case_id)}
              >
                {linkingId === `${sightingId}-${candidate.case_id}`
                  ? 'Linking…'
                  : 'Link and notify owner'}
              </button>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function FoundPetMatches({
  reports,
  locale,
  onLinked,
}: {
  reports: FoundPetReport[]
  locale: AppLocale
  onLinked: () => Promise<void>
}) {
  const { t } = useTranslation()
  const [candidates, setCandidates] = useState<
    Record<string, MatchCandidate[]>
  >({})
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [analysingId, setAnalysingId] = useState<string | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const photoUrls = useSignedPhotoUrls(
    reports.map((report) => ({
      id: report.id,
      path:
        report.photo?.display_object_path ??
        report.photo?.source_object_path ??
        null,
    })),
    moderationApi.signedPhoto,
  )
  const [error, setError] = useState('')
  async function showCandidates(reportId: string) {
    if (candidates[reportId]) return
    setLoadingId(reportId)
    try {
      const result = await moderationApi.foundCandidates(reportId)
      setCandidates((current) => ({
        ...current,
        [reportId]: (result ?? []) as MatchCandidate[],
      }))
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'We could not find candidates.',
      )
    } finally {
      setLoadingId(null)
    }
  }
  async function link(reportId: string, caseId: string) {
    setLinkingId(`${reportId}-${caseId}`)
    try {
      await moderationApi.linkFound(reportId, caseId)
      await onLinked()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'We could not link this report.',
      )
    } finally {
      setLinkingId(null)
    }
  }
  async function analyse(reportId: string) {
    setAnalysingId(reportId)
    setError('')
    try {
      await moderationApi.scoreFound(reportId)
      await onLinked()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'We could not analyse this report.',
      )
    } finally {
      setAnalysingId(null)
    }
  }
  async function review(reportId: string, decision: 'approved' | 'rejected') {
    setReviewingId(reportId)
    setError('')
    try {
      await moderationApi.reviewFound(reportId, decision)
      await onLinked()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'We could not review this report.',
      )
    } finally {
      setReviewingId(null)
    }
  }
  const statusLabel = {
    pending: t('moderation.moderationPending'),
    approved: t('moderation.moderationApproved'),
    rejected: t('moderation.moderationRejected'),
  } as const
  const activeReports = reports.filter(
    (report) => report.lifecycle_status === 'active',
  )
  const closedReports = reports.filter(
    (report) => report.lifecycle_status !== 'active',
  )
  function card(report: FoundPetReport) {
    const matched = report.link?.case
    return (
      <article className="found-match-card" key={report.id}>
        <div className="found-report-summary">
          <div>
            <p className={`moderation-status ${report.moderation_status}`}>
              {statusLabel[report.moderation_status]}
            </p>
            <p className={`moderation-status ${report.lifecycle_status}`}>
              {t(`moderation.lifecycle.${report.lifecycle_status}`)}
            </p>
            <p className="moderation-status">
              {t(`common.${report.species}`)} ·{' '}
              {formatDateTime(report.found_at, locale)}
            </p>
            <h3>
              {[report.colour, report.breed].filter(Boolean).join(' · ') ||
                t('moderation.foundPet')}
            </h3>
            <p>{report.details}</p>
            {report.automated_screening_note && (
              <p className="report-meta">
                {t('moderation.automatedFlag', {
                  note: report.automated_screening_note,
                })}
              </p>
            )}
            {report.lifecycle_reason && (
              <p className="report-meta">
                {t('moderation.lifecycleReason', {
                  reason: report.lifecycle_reason,
                })}
              </p>
            )}
            <dl>
              <div>
                <dt>{t('moderation.custody')}</dt>
                <dd>{t(`found.custody.${report.custody_status}`)}</dd>
              </div>
              {report.location_description && (
                <div>
                  <dt>{t('moderation.foundLocation')}</dt>
                  <dd>{report.location_description}</dd>
                </div>
              )}
            </dl>
          </div>
          {report.photo && (
            <figure className="found-photo-review">
              {photoUrls[report.id] ? (
                <img
                  src={photoUrls[report.id] ?? ''}
                  alt={t('moderation.photo')}
                />
              ) : photoUrls[report.id] === null ? (
                <p>{t('moderation.photoUnavailable')}</p>
              ) : (
                <p className="report-meta">{t('moderation.photo')}</p>
              )}
            </figure>
          )}
        </div>
        {report.lifecycle_status === 'active' &&
          report.moderation_status === 'pending' && (
            <div className="found-match-actions">
              <button
                type="button"
                disabled={reviewingId === report.id}
                onClick={() => void review(report.id, 'approved')}
              >
                {reviewingId === report.id
                  ? t('moderation.reviewing')
                  : t('moderation.approve')}
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={reviewingId === report.id}
                onClick={() => void review(report.id, 'rejected')}
              >
                {reviewingId === report.id
                  ? t('moderation.reviewing')
                  : t('moderation.reject')}
              </button>
            </div>
          )}
        {report.lifecycle_status === 'active' &&
          report.moderation_status === 'approved' &&
          (matched ? (
            <p className="found-match-linked">
              <Icon name="check-line" />
              {t('moderation.linkedTo', {
                petName: matched.pet?.name ?? t('moderation.case'),
              })}
            </p>
          ) : (
            <div className="found-match-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={loadingId === report.id}
                onClick={() => void showCandidates(report.id)}
              >
                {loadingId === report.id
                  ? t('moderation.findingMatches')
                  : t('moderation.findMatches')}
              </button>
              {candidates[report.id] && (
                <>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={analysingId === report.id}
                    onClick={() => void analyse(report.id)}
                  >
                    {analysingId === report.id
                      ? 'Analysing photos and descriptions…'
                      : 'Run AI analysis'}
                  </button>
                  <p className="ai-review-note">
                    An owner-review link is created automatically only when one
                    candidate has deterministic and combined scores of at least
                    80, with medium or high AI confidence. You can also link any
                    listed candidate.
                  </p>
                  <CandidateList
                    candidates={candidates[report.id]}
                    scores={report.ai_scores}
                    reportId={report.id}
                    linkingId={linkingId}
                    locale={locale}
                    onLink={link}
                  />
                </>
              )}
            </div>
          ))}
        <LifecycleActions report={report} onComplete={onLinked} />
      </article>
    )
  }
  return (
    <section
      className="found-match-section"
      aria-labelledby="found-matches-title"
    >
      <div className="found-match-heading">
        <div>
          <h2 id="found-matches-title">{t('moderation.foundMatches')}</h2>
          <p>{t('moderation.foundMatchesIntro')}</p>
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
      <h3 className="queue-heading">{t('moderation.activeQueue')}</h3>
      {activeReports.length === 0 ? (
        <section className="dashboard-empty">
          <h3>{t('moderation.noFoundReports')}</h3>
          <p>{t('moderation.noFoundReportsBody')}</p>
        </section>
      ) : (
        <div className="found-match-list">{activeReports.map(card)}</div>
      )}
      {closedReports.length > 0 && (
        <details className="lifecycle-archive">
          <summary>
            {t('moderation.closedQueue', { count: closedReports.length })}
          </summary>
          <div className="found-match-list">{closedReports.map(card)}</div>
        </details>
      )}
    </section>
  )
}

function LifecycleActions({
  report,
  onComplete,
}: {
  report: FoundPetReport
  onComplete: () => Promise<void>
}) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('resolved')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function manage(action: 'resolved' | 'expired' | 'reopen' | 'delete') {
    setSaving(true)
    setError('')
    try {
      await moderationApi.manageFound(report.id, action, reason)
      await onComplete()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'We could not manage this report.',
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="lifecycle-actions">
      <label>
        {t('moderation.lifecycleReasonLabel')}
        <select
          value={reason}
          disabled={saving}
          onChange={(event) => setReason(event.target.value)}
        >
          <option value="resolved">{t('moderation.reason.resolved')}</option>
          <option value="duplicate">{t('moderation.reason.duplicate')}</option>
          <option value="test">{t('moderation.reason.test')}</option>
          <option value="stale">{t('moderation.reason.stale')}</option>
          <option value="other">{t('moderation.reason.other')}</option>
        </select>
      </label>
      <div>
        {report.lifecycle_status === 'active' ? (
          <>
            <button
              className="secondary-button"
              type="button"
              disabled={saving}
              onClick={() => void manage('resolved')}
            >
              {t('moderation.resolve')}
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={saving}
              onClick={() => void manage('expired')}
            >
              {t('moderation.expire')}
            </button>
          </>
        ) : (
          <button
            className="secondary-button"
            type="button"
            disabled={saving}
            onClick={() => void manage('reopen')}
          >
            {t('moderation.reopen')}
          </button>
        )}
        <button
          className="text-button danger-text-button"
          type="button"
          disabled={saving}
          onClick={() => void manage('delete')}
        >
          {saving
            ? t('moderation.savingLifecycle')
            : t('moderation.deleteReport')}
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}

function CandidateList({
  candidates,
  scores,
  reportId,
  linkingId,
  locale,
  onLink,
}: {
  candidates: MatchCandidate[]
  scores: AiCandidateScore[]
  reportId: string
  linkingId: string | null
  locale: AppLocale
  onLink: (reportId: string, caseId: string) => Promise<void>
}) {
  const { t } = useTranslation()
  if (candidates.length === 0)
    return <p className="found-match-none">{t('moderation.noCandidates')}</p>
  return (
    <ol className="candidate-list">
      {candidates.map((candidate) => {
        const ai = scores.find((score) => score.case_id === candidate.case_id)
        return (
          <li key={candidate.case_id}>
            <div>
              <strong>{candidate.pet_name}</strong>
              <span>
                {[candidate.colour, candidate.breed]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              <small>
                {candidate.distance_km} km ·{' '}
                {candidate.last_seen_at
                  ? formatDateTime(candidate.last_seen_at, locale)
                  : t('moderation.lastSeenUnknown')}
              </small>
              <p>{candidate.match_reasons.join(' · ')}</p>
              {ai && (
                <div className="ai-candidate-score">
                  <strong>
                    {ai.priority_review
                      ? 'Priority staff review'
                      : 'AI review result'}
                  </strong>
                  <span>
                    AI similarity {ai.ai_similarity_score} · combined{' '}
                    {ai.combined_score} · {ai.confidence} confidence
                  </span>
                  <p>{ai.explanation}</p>
                </div>
              )}
            </div>
            <div className="candidate-action">
              <b>{candidate.match_score}</b>
              <button
                type="button"
                disabled={linkingId === `${reportId}-${candidate.case_id}`}
                onClick={() => void onLink(reportId, candidate.case_id)}
              >
                {linkingId === `${reportId}-${candidate.case_id}`
                  ? t('moderation.linking')
                  : t('moderation.linkCase')}
              </button>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
