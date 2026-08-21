import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useParams } from 'react-router'
import { PublicLocationMap } from '../../components/maps/PublicLocationMap'
import { Icon } from '../../components/Icon'
import { PetImage } from '../../components/PetImage'
import { PublicCaseNotice } from '../../components/PublicCaseNotice'
import { Link, SiteFooter, SiteHeader } from '../../components/SiteChrome'
import { formatDateTime } from '../../i18n/format'
import type { AppLocale } from '../../i18n/resources'
import { usePublicCaseQuery } from '../../features/public-cases/queries'
import type { PublicCase } from '../../features/public-cases/types'
import { CaseMetadata } from '../../lib/metadata'
import { publicCaseUrl, socialCardUrl } from '../../lib/public-case'
import { supabase } from '../../lib/supabase'

export function PublicCasePage() {
  const { t, i18n } = useTranslation(); const location = useLocation()
  const { slug } = useParams()
  const { data: caseData, isError, isPending } = usePublicCaseQuery(slug)
  useEffect(() => { const token = new URLSearchParams(location.search).get('via'); if (supabase && slug && token && /^[0-9a-f-]{36}$/i.test(token)) void supabase.rpc('record_share_attribution', { case_slug: slug, share_token: token }) }, [location.search, slug])

  const content = isPending ? <PublicCaseNotice title={t('publicCase.loadingTitle')} body={t('publicCase.loadingBody')} />
    : isError ? <PublicCaseNotice title={t('publicCase.unavailableTitle')} body={t('publicCase.unavailableBody')} />
      : !caseData ? <PublicCaseNotice title={t('publicCase.notFoundTitle')} body={t('publicCase.notFoundBody')} />
        : <PublicCaseContent caseData={caseData} locale={i18n.resolvedLanguage as AppLocale} />

  return <div className="public-shell"><SiteHeader /><main className="public-case"><Link className="back-link" to="/"><Icon name="arrow-left" />{t('common.backToCases')}</Link>{content}</main><SiteFooter /></div>
}

function PublicCaseContent({ caseData, locale }: { caseData: PublicCase, locale: AppLocale }) {
  const { t } = useTranslation()
  const heading = caseData.title || t('publicCase.title', { petName: caseData.pet_name })
  const descriptionTitle = [caseData.colour, caseData.breed].filter(Boolean).join(' · ') || t('publicCase.descriptionTitle')
  const lastSeen = caseData.last_seen_at ? formatDateTime(caseData.last_seen_at, locale) : t('publicCase.lastSeenUnknown')
  const area = caseData.last_seen_description || t('publicCase.approximateArea')
  return <><CaseMetadata title={`${heading} | Pet Seen`} description={t('publicCase.leadForPet', { petName: caseData.pet_name })} canonicalUrl={publicCaseUrl(caseData.public_slug, locale)} imageUrl={socialCardUrl(caseData.public_slug)} /><div className="case-grid"><PetImage className="pet-photo" petName={caseData.pet_name} species={caseData.species} publicSlug={caseData.public_slug} /><section className="case-summary"><p className="status-badge"><span />{t('publicCase.status')}</p><h1>{heading}</h1><p className="case-lead">{t('publicCase.leadForPet', { petName: caseData.pet_name })}</p><dl className="case-facts"><div><dt>{t('publicCase.lastSeen')}</dt><dd>{lastSeen}</dd></div><div><dt>{t('publicCase.area')}</dt><dd><Icon name="map-pin-2" />{area}</dd></div></dl><Link className="primary-cta report-cta" to="/sighting/new"><Icon name="eye" />{t('publicCase.action', { petName: caseData.pet_name })}</Link><p className="privacy-note"><Icon name="shield-check" />{t('publicCase.privacy', { petName: caseData.pet_name })}</p></section></div><ShareCasePanel caseData={caseData} locale={locale} heading={heading} /><section className="case-details"><div><p className="eyebrow">{t('publicCase.about', { petName: caseData.pet_name })}</p><h2>{descriptionTitle}</h2><p>{caseData.pet_description || t('publicCase.description', { petName: caseData.pet_name })}</p></div><div className="map-card"><PublicLocationMap latitude={caseData.public_latitude} longitude={caseData.public_longitude} label={t('publicCase.mapLabel', { petName: caseData.pet_name })} /><p><Icon name="information" />{t('publicCase.mapNote', { petName: caseData.pet_name })}</p></div></section><ContentReportForm caseSlug={caseData.public_slug} /></>
}

function ShareCasePanel({ caseData, locale, heading }: { caseData: PublicCase, locale: AppLocale, heading: string }) {
  const { t } = useTranslation(); const baseUrl = publicCaseUrl(caseData.public_slug, locale); const [status, setStatus] = useState(''); const shareText = t('publicCase.shareText', { petName: caseData.pet_name })
  async function attributedUrl(channel: 'copy' | 'web_share' | 'whatsapp' | 'poster') { if (!supabase) return baseUrl; const { data, error } = await supabase.rpc('create_share_attribution', { case_slug: caseData.public_slug, share_channel: channel }); return error || !data ? baseUrl : `${baseUrl}?via=${data}` }
  async function share() { try { await navigator.share({ title: heading, text: shareText, url: await attributedUrl('web_share') }); setStatus(t('publicCase.shared')) } catch (error) { if ((error as DOMException).name !== 'AbortError') setStatus(t('publicCase.shareError')) } }
  async function copy() { const url = await attributedUrl('copy'); try { await navigator.clipboard.writeText(url); setStatus(t('publicCase.copied')) } catch { const input = document.createElement('textarea'); input.value = url; input.style.position = 'fixed'; input.style.opacity = '0'; document.body.append(input); input.select(); const copied = document.execCommand('copy'); input.remove(); setStatus(copied ? t('publicCase.copied') : t('publicCase.copyError')) } }
  async function whatsApp() { const url = await attributedUrl('whatsapp'); window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`, '_blank', 'noopener,noreferrer') }
  async function poster() { const url = await attributedUrl('poster'); window.open(`${url.replace(/\?.*$/, '')}/poster?via=${new URL(url).searchParams.get('via')}`, '_blank', 'noopener,noreferrer') }
  return <section className="share-panel" aria-labelledby="share-case-heading"><div><p className="eyebrow">{t('publicCase.shareEyebrow')}</p><h2 id="share-case-heading">{t('publicCase.shareTitle')}</h2><p>{t('publicCase.shareIntro')}</p></div><div className="share-actions"><button className="secondary-button" type="button" onClick={() => void copy()}><Icon name="file-copy" />{t('publicCase.copyLink')}</button>{typeof navigator !== 'undefined' && 'share' in navigator && <button className="secondary-button" type="button" onClick={() => void share()}><Icon name="share-line" />{t('publicCase.share')}</button>}<button className="secondary-button" type="button" onClick={() => void whatsApp()}><Icon name="whatsapp" />{t('publicCase.whatsApp')}</button><button className="secondary-button" type="button" onClick={() => void poster()}><Icon name="printer" />{t('publicCase.poster')}</button></div>{status && <p className="share-status" role="status">{status}</p>}</section>
}

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
