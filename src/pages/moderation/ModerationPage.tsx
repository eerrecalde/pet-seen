import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth/useAuth'
import { Icon } from '../../components/Icon'
import { Link, SiteFooter, SiteHeader } from '../../components/SiteChrome'
import { formatDateTime } from '../../i18n/format'
import type { AppLocale } from '../../i18n/resources'
import { supabase } from '../../lib/supabase'

type ContentReportStatus = 'open' | 'reviewed' | 'dismissed' | 'actioned'
type ModerationReport = { id: string, reason: 'incorrect' | 'harmful' | 'scam' | 'other', details: string | null, status: ContentReportStatus, created_at: string, case: { public_slug: string, title: string | null, pet: { name: string } | null } | null }
type FoundPetReport = { id: string, species: 'dog' | 'cat', breed: string | null, colour: string | null, details: string, custody_status: 'with_reporter' | 'with_vet_or_rescue' | 'not_in_custody', location_description: string | null, found_at: string, created_at: string, moderation_status: 'pending' | 'approved' | 'rejected', lifecycle_status: 'active' | 'resolved' | 'expired', lifecycle_reason: string | null, automated_screening_note: string | null, photo: { source_object_path: string, display_object_path: string | null } | null, link: { case_id: string, status: 'pending_owner' | 'confirmed' | 'declined', case: { public_slug: string, pet: { name: string } | null } | null } | null }
type MatchCandidate = { case_id: string, public_slug: string, pet_name: string, breed: string | null, colour: string | null, last_seen_at: string | null, distance_km: number, match_score: number, match_reasons: string[] }

export function ModerationPage() {
  const { t, i18n } = useTranslation()
  const { isLoading, session } = useAuth()
  const [access, setAccess] = useState<'checking' | 'allowed' | 'denied'>('checking')
  const [reports, setReports] = useState<ModerationReport[]>([])
  const [foundReports, setFoundReports] = useState<FoundPetReport[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [housekeeping, setHousekeeping] = useState<'idle' | 'running' | 'error'>('idle')
  const loadReports = useCallback(async () => {
    if (!supabase) return
    setState('loading')
    const [contentResult, foundResult] = await Promise.all([
      supabase.from('content_reports').select('id,reason,details,status,created_at,case:missing_cases(public_slug,title,pet:pets(name))').order('created_at', { ascending: false }),
      supabase.from('found_pet_reports').select('id,species,breed,colour,details,custody_status,location_description,found_at,created_at,moderation_status,lifecycle_status,lifecycle_reason,automated_screening_note,photo:found_pet_photos(source_object_path,display_object_path),link:found_pet_case_links(case_id,status,case:missing_cases(public_slug,pet:pets(name)))').order('created_at', { ascending: false })
    ])
    if (contentResult.error || foundResult.error) { setState('error'); return }
    setReports((contentResult.data ?? []).map((report) => { const caseData = Array.isArray(report.case) ? report.case[0] ?? null : report.case; return { ...report, case: caseData ? { ...caseData, pet: Array.isArray(caseData.pet) ? caseData.pet[0] ?? null : caseData.pet } : null } }) as unknown as ModerationReport[])
    setFoundReports((foundResult.data ?? []).map((report) => {
      const link = Array.isArray(report.link) ? report.link[0] ?? null : report.link
      const photo = Array.isArray(report.photo) ? report.photo[0] ?? null : report.photo
      return { ...report, photo, link: link ? { ...link, case: Array.isArray(link.case) ? link.case[0] ?? null : link.case } : null }
    }) as unknown as FoundPetReport[])
    setState('ready')
  }, [])
  useEffect(() => { if (!session || !supabase) { setAccess('denied'); return }; void supabase.rpc('is_authorized_staff').then(({ data, error }) => { const allowed = !error && data === true; setAccess(allowed ? 'allowed' : 'denied'); if (allowed) void loadReports() }) }, [loadReports, session])
  async function updateStatus(report: ModerationReport, status: ContentReportStatus) { if (!supabase) return; setSavingId(report.id); const { error } = await supabase.from('content_reports').update({ status }).eq('id', report.id); setSavingId(null); if (!error) await loadReports() }
  async function runHousekeeping() { if (!supabase) return; setHousekeeping('running'); const { error } = await supabase.functions.invoke('housekeep-found-pet-reports'); setHousekeeping(error ? 'error' : 'idle'); if (!error) await loadReports() }
  if (isLoading || access === 'checking') return <main className="moderation-shell"><p>{t('moderation.checking')}</p></main>
  if (access === 'denied') return <main className="moderation-shell"><section className="auth-card"><p className="eyebrow">{t('moderation.eyebrow')}</p><h1>{t('moderation.deniedTitle')}</h1><p>{t('moderation.deniedBody')}</p><Link className="primary-cta" to={session ? '/' : '/auth'}>{session ? t('common.backToHome') : t('common.signIn')}<Icon name="arrow-right" /></Link></section></main>
  return <div className="moderation-page"><SiteHeader /><main className="moderation-shell"><section className="moderation-intro"><p className="eyebrow">{t('moderation.eyebrow')}</p><h1>{t('moderation.title')}</h1><p>{t('moderation.intro')}</p><button className="secondary-button housekeeping-button" type="button" disabled={housekeeping === 'running'} onClick={() => void runHousekeeping()}>{housekeeping === 'running' ? t('moderation.runningHousekeeping') : t('moderation.runHousekeeping')}</button>{housekeeping === 'error' && <p className="form-error">{t('moderation.housekeepingError')}</p>}</section>{state === 'loading' ? <p>{t('moderation.loading')}</p> : state === 'error' ? <p className="form-error">{t('moderation.error')}</p> : <><FoundPetMatches reports={foundReports} locale={i18n.resolvedLanguage as AppLocale} onLinked={loadReports} /><section className="moderation-content-reports"><h2>{t('moderation.contentReports')}</h2>{reports.length === 0 ? <section className="dashboard-empty"><h3>{t('moderation.emptyTitle')}</h3><p>{t('moderation.emptyBody')}</p></section> : <div className="moderation-list">{reports.map((report) => <article className="moderation-report" key={report.id}><div><p className={`moderation-status ${report.status}`}>{t(`moderation.status.${report.status}`)}</p><h3>{report.case?.title || (report.case?.pet?.name ? t('publicCase.title', { petName: report.case.pet.name }) : t('moderation.unavailableCase'))}</h3><p className="report-meta">{t(`contentReport.reasons.${report.reason}`)} · {formatDateTime(report.created_at, i18n.resolvedLanguage as AppLocale)}</p>{report.details && <p className="report-details">{report.details}</p>}{report.case && <Link className="case-link" to={`/find/${report.case.public_slug}`}>{t('moderation.viewCase')}<Icon name="external-link" /></Link>}</div><label className="status-control">{t('moderation.statusLabel')}<select aria-label={t('moderation.statusLabel')} disabled={savingId === report.id} value={report.status} onChange={(event) => void updateStatus(report, event.target.value as ContentReportStatus)}><option value="open">{t('moderation.status.open')}</option><option value="reviewed">{t('moderation.status.reviewed')}</option><option value="dismissed">{t('moderation.status.dismissed')}</option><option value="actioned">{t('moderation.status.actioned')}</option></select></label></article>)}</div>}</section></>}</main><SiteFooter /></div>
}

function FoundPetMatches({ reports, locale, onLinked }: { reports: FoundPetReport[], locale: AppLocale, onLinked: () => Promise<void> }) {
  const { t } = useTranslation()
  const [candidates, setCandidates] = useState<Record<string, MatchCandidate[]>>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [photoUrls, setPhotoUrls] = useState<Record<string, string | null>>({})
  const [error, setError] = useState('')
  useEffect(() => {
    if (!supabase) return
    const client = supabase
    void Promise.all(reports.map(async (report) => {
      const path = report.photo?.display_object_path ?? report.photo?.source_object_path
      if (!path || report.id in photoUrls) return null
      const { data } = await client.storage.from('found-pet-photos').createSignedUrl(path, 60)
      return [report.id, data?.signedUrl ?? null] as const
    })).then((urls) => {
      const resolved = Object.fromEntries(urls.filter((url): url is readonly [string, string | null] => Boolean(url)))
      if (Object.keys(resolved).length > 0) setPhotoUrls((current) => ({ ...current, ...resolved }))
    })
  }, [photoUrls, reports])
  async function showCandidates(reportId: string) { if (!supabase || candidates[reportId]) return; setLoadingId(reportId); const { data, error: candidateError } = await supabase.rpc('found_pet_case_candidates', { target_report_id: reportId }); setLoadingId(null); if (candidateError) { setError(candidateError.message); return }; setCandidates((current) => ({ ...current, [reportId]: (data ?? []) as MatchCandidate[] })) }
  async function link(reportId: string, caseId: string) { if (!supabase) return; setLinkingId(`${reportId}-${caseId}`); const { error: linkError } = await supabase.rpc('link_found_pet_report_to_case', { target_report_id: reportId, target_case_id: caseId }); setLinkingId(null); if (linkError) { setError(linkError.message); return }; await onLinked() }
  async function review(reportId: string, decision: 'approved' | 'rejected') {
    if (!supabase) return
    setReviewingId(reportId); setError('')
    const { error: reviewError } = await supabase.functions.invoke('moderate-found-pet-report', { body: { reportId, decision } })
    setReviewingId(null)
    if (reviewError) { setError(reviewError.message); return }
    await onLinked()
  }
  const statusLabel = { pending: t('moderation.moderationPending'), approved: t('moderation.moderationApproved'), rejected: t('moderation.moderationRejected') } as const
  const activeReports = reports.filter((report) => report.lifecycle_status === 'active')
  const closedReports = reports.filter((report) => report.lifecycle_status !== 'active')
  function card(report: FoundPetReport) { return <article className="found-match-card" key={report.id}><div className="found-report-summary"><div><p className={`moderation-status ${report.moderation_status}`}>{statusLabel[report.moderation_status]}</p><p className={`moderation-status ${report.lifecycle_status}`}>{t(`moderation.lifecycle.${report.lifecycle_status}`)}</p><p className="moderation-status">{t(`common.${report.species}`)} · {formatDateTime(report.found_at, locale)}</p><h3>{[report.colour, report.breed].filter(Boolean).join(' · ') || t('moderation.foundPet')}</h3><p>{report.details}</p>{report.automated_screening_note && <p className="report-meta">{t('moderation.automatedFlag', { note: report.automated_screening_note })}</p>}{report.lifecycle_reason && <p className="report-meta">{t('moderation.lifecycleReason', { reason: report.lifecycle_reason })}</p>}<dl><div><dt>{t('moderation.custody')}</dt><dd>{t(`found.custody.${report.custody_status}`)}</dd></div>{report.location_description && <div><dt>{t('moderation.foundLocation')}</dt><dd>{report.location_description}</dd></div>}</dl></div>{report.photo && <figure className="found-photo-review">{photoUrls[report.id] ? <img src={photoUrls[report.id] ?? ''} alt={t('moderation.photo')} /> : photoUrls[report.id] === null ? <p>{t('moderation.photoUnavailable')}</p> : <p className="report-meta">{t('moderation.photo')}</p>}</figure>}</div>{report.lifecycle_status === 'active' && (report.moderation_status === 'pending' ? <div className="found-match-actions"><button type="button" disabled={reviewingId === report.id} onClick={() => void review(report.id, 'approved')}>{reviewingId === report.id ? t('moderation.reviewing') : t('moderation.approve')}</button><button className="secondary-button" type="button" disabled={reviewingId === report.id} onClick={() => void review(report.id, 'rejected')}>{reviewingId === report.id ? t('moderation.reviewing') : t('moderation.reject')}</button></div> : report.moderation_status === 'approved' && (report.link?.case ? <p className="found-match-linked"><Icon name="check-line" />{t('moderation.linkedTo', { petName: report.link.case.pet?.name ?? t('moderation.case') })}</p> : <div className="found-match-actions"><button className="secondary-button" type="button" disabled={loadingId === report.id} onClick={() => void showCandidates(report.id)}>{loadingId === report.id ? t('moderation.findingMatches') : t('moderation.findMatches')}</button>{candidates[report.id] && <CandidateList candidates={candidates[report.id]} reportId={report.id} linkingId={linkingId} locale={locale} onLink={link} />}</div>))}<LifecycleActions report={report} onComplete={onLinked} /></article> }
  return <section className="found-match-section" aria-labelledby="found-matches-title"><div className="found-match-heading"><div><h2 id="found-matches-title">{t('moderation.foundMatches')}</h2><p>{t('moderation.foundMatchesIntro')}</p></div></div>{error && <p className="form-error">{error}</p>}<h3 className="queue-heading">{t('moderation.activeQueue')}</h3>{activeReports.length === 0 ? <section className="dashboard-empty"><h3>{t('moderation.noFoundReports')}</h3><p>{t('moderation.noFoundReportsBody')}</p></section> : <div className="found-match-list">{activeReports.map(card)}</div>}{closedReports.length > 0 && <details className="lifecycle-archive"><summary>{t('moderation.closedQueue', { count: closedReports.length })}</summary><div className="found-match-list">{closedReports.map(card)}</div></details>}</section>
}

function LifecycleActions({ report, onComplete }: { report: FoundPetReport, onComplete: () => Promise<void> }) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('resolved')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function manage(action: 'resolved' | 'expired' | 'reopen' | 'delete') {
    if (!supabase) return
    setSaving(true); setError('')
    const { error: requestError } = await supabase.functions.invoke('manage-found-pet-report', { body: { reportId: report.id, action, reason } })
    setSaving(false)
    if (requestError) { setError(requestError.message); return }
    await onComplete()
  }
  return <div className="lifecycle-actions"><label>{t('moderation.lifecycleReasonLabel')}<select value={reason} disabled={saving} onChange={(event) => setReason(event.target.value)}><option value="resolved">{t('moderation.reason.resolved')}</option><option value="duplicate">{t('moderation.reason.duplicate')}</option><option value="test">{t('moderation.reason.test')}</option><option value="stale">{t('moderation.reason.stale')}</option><option value="other">{t('moderation.reason.other')}</option></select></label><div>{report.lifecycle_status === 'active' ? <><button className="secondary-button" type="button" disabled={saving} onClick={() => void manage('resolved')}>{t('moderation.resolve')}</button><button className="secondary-button" type="button" disabled={saving} onClick={() => void manage('expired')}>{t('moderation.expire')}</button></> : <button className="secondary-button" type="button" disabled={saving} onClick={() => void manage('reopen')}>{t('moderation.reopen')}</button>}<button className="text-button danger-text-button" type="button" disabled={saving} onClick={() => void manage('delete')}>{saving ? t('moderation.savingLifecycle') : t('moderation.deleteReport')}</button></div>{error && <p className="form-error">{error}</p>}</div>
}

function CandidateList({ candidates, reportId, linkingId, locale, onLink }: { candidates: MatchCandidate[], reportId: string, linkingId: string | null, locale: AppLocale, onLink: (reportId: string, caseId: string) => Promise<void> }) {
  const { t } = useTranslation()
  if (candidates.length === 0) return <p className="found-match-none">{t('moderation.noCandidates')}</p>
  return <ol className="candidate-list">{candidates.map((candidate) => <li key={candidate.case_id}><div><strong>{candidate.pet_name}</strong><span>{[candidate.colour, candidate.breed].filter(Boolean).join(' · ')}</span><small>{candidate.distance_km} km · {candidate.last_seen_at ? formatDateTime(candidate.last_seen_at, locale) : t('moderation.lastSeenUnknown')}</small><p>{candidate.match_reasons.join(' · ')}</p></div><div className="candidate-action"><b>{candidate.match_score}</b><button type="button" disabled={linkingId === `${reportId}-${candidate.case_id}`} onClick={() => void onLink(reportId, candidate.case_id)}>{linkingId === `${reportId}-${candidate.case_id}` ? t('moderation.linking') : t('moderation.linkCase')}</button></div></li>)}</ol>
}
