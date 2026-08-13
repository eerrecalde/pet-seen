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

export function ModerationPage() {
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
