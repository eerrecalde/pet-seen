import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth/useAuth'
import { Icon } from '../../components/Icon'
import { Link, SiteFooter, SiteHeader } from '../../components/SiteChrome'
import { formatDateTime } from '../../i18n/format'
import type { AppLocale } from '../../i18n/resources'
import { supabase } from '../../lib/supabase'

type FollowUpReport = {
  id: string
  species: 'dog' | 'cat'
  breed: string | null
  colour: string | null
  custody_status: 'with_reporter' | 'with_vet_or_rescue' | 'not_in_custody'
  found_at: string
  link: { status: 'pending_owner' | 'confirmed', case: { pet: { name: string } | null } | null } | null
}
type Message = { id: string, sender_id: string, body: string, created_at: string }

export function FoundPetFollowUpPage() {
  const { t, i18n } = useTranslation()
  const { isLoading, session } = useAuth()
  const [reports, setReports] = useState<FollowUpReport[]>([])
  const [messages, setMessages] = useState<Record<string, Message[]>>({})
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [sendingId, setSendingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !session) return
    setState('loading')
    const claim = await supabase.rpc('claim_found_pet_reporter_access')
    if (claim.error) { setState('error'); return }
    const { data, error } = await supabase.from('found_pet_reports').select('id,species,breed,colour,custody_status,found_at,link:found_pet_case_links(status,case:missing_cases(pet:pets(name)))').eq('reporter_id', session.user.id).order('found_at', { ascending: false })
    if (error) { setState('error'); return }
    const nextReports = (data ?? []).map((report) => ({ ...report, link: Array.isArray(report.link) ? report.link[0] ?? null : report.link })) as unknown as FollowUpReport[]
    setReports(nextReports)
    const connectedIds = nextReports.filter((report) => report.link?.status === 'confirmed').map((report) => report.id)
    if (connectedIds.length) {
      const result = await supabase.from('found_pet_messages').select('id,sender_id,body,created_at,found_pet_report_id').in('found_pet_report_id', connectedIds).order('created_at')
      if (result.error) { setState('error'); return }
      setMessages((result.data ?? []).reduce<Record<string, Message[]>>((all, message) => ({ ...all, [message.found_pet_report_id]: [...(all[message.found_pet_report_id] ?? []), message] }), {}))
    } else setMessages({})
    setState('ready')
  }, [session])

  useEffect(() => { if (session) void load() }, [load, session])

  async function send(event: FormEvent<HTMLFormElement>, reportId: string) {
    event.preventDefault()
    if (!supabase) return
    const body = String(new FormData(event.currentTarget).get('message') ?? '').trim()
    if (!body) return
    setSendingId(reportId)
    const { error } = await supabase.rpc('send_found_pet_message', { target_report_id: reportId, message_body: body })
    setSendingId(null)
    if (!error) { event.currentTarget.reset(); await load() }
  }

  if (isLoading) return <main className="dashboard-shell"><p>{t('auth.loading')}</p></main>
  if (!session) return <main className="dashboard-shell"><section className="auth-card"><p className="eyebrow">{t('found.followUpTitle')}</p><h1>{t('found.followUpSignInTitle')}</h1><p>{t('found.followUpSignInBody')}</p><Link className="primary-cta" to="/auth">{t('common.signIn')}<Icon name="arrow-right" /></Link></section></main>
  return <div className="dashboard-page"><SiteHeader /><main className="dashboard-shell follow-up-shell"><div className="dashboard-intro"><div><p className="eyebrow">{t('found.followUpTitle')}</p><h1>{t('found.followUpPageTitle')}</h1><p>{t('found.followUpPageIntro')}</p></div></div>{state === 'loading' ? <p>{t('auth.loading')}</p> : state === 'error' ? <p className="form-error">{t('found.followUpLoadError')}</p> : reports.length === 0 ? <section className="dashboard-empty"><h2>{t('found.followUpEmptyTitle')}</h2><p>{t('found.followUpEmptyBody')}</p></section> : <div className="follow-up-list">{reports.map((report) => <article className="follow-up-report" key={report.id}><div><p className="moderation-status">{t(`common.${report.species}`)} · {formatDateTime(report.found_at, i18n.resolvedLanguage as AppLocale)}</p><h2>{[report.colour, report.breed].filter(Boolean).join(' · ') || t('moderation.foundPet')}</h2><p>{t(`found.custody.${report.custody_status}`)}</p></div>{report.link?.status === 'confirmed' ? <Conversation messages={messages[report.id] ?? []} reportId={report.id} sending={sendingId === report.id} sessionUserId={session.user.id} onSend={send} /> : <p className="follow-up-status">{report.link ? t('found.followUpAwaitingOwner') : t('found.followUpNoMatch')}</p>}</article>)}</div>}</main><SiteFooter /></div>
}

function Conversation({ messages, reportId, sending, sessionUserId, onSend }: { messages: Message[], reportId: string, sending: boolean, sessionUserId: string, onSend: (event: FormEvent<HTMLFormElement>, reportId: string) => Promise<void> }) {
  const { t } = useTranslation()
  return <section className="private-conversation" aria-label={t('found.conversationTitle')}><h3>{t('found.conversationTitle')}</h3><p>{t('found.conversationHelp')}</p>{messages.length > 0 && <ol>{messages.map((message) => <li className={message.sender_id === sessionUserId ? 'mine' : ''} key={message.id}>{message.body}</li>)}</ol>}<form onSubmit={(event) => void onSend(event, reportId)}><label>{t('found.messageLabel')}<textarea name="message" maxLength={1500} required rows={3} /></label><button className="primary-cta" disabled={sending} type="submit">{sending ? t('found.messageSending') : t('found.messageSend')}</button></form></section>
}
