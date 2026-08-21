import { type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth/useAuth'
import { Icon } from '../../components/Icon'
import { Link, SiteFooter, SiteHeader } from '../../components/SiteChrome'
import { formatDateTime } from '../../i18n/format'
import type { AppLocale } from '../../i18n/resources'
import { useReporterFollowUpQuery } from '../../features/reporter-follow-up/queries'
import { useReporterMessageMutation } from '../../features/reporter-follow-up/mutations'
import type { FollowUpMessage } from '../../features/reporter-follow-up/api'

export function FoundPetFollowUpPage() {
  const { t, i18n } = useTranslation()
  const { isLoading, session } = useAuth()
  const followUp = useReporterFollowUpQuery(session?.user.id)
  const sendMessage = useReporterMessageMutation(session?.user.id ?? '')
  const reports = followUp.data?.reports ?? []
  const messages = followUp.data?.messages ?? {}

  async function send(event: FormEvent<HTMLFormElement>, reportId: string) {
    event.preventDefault()
    const body = String(
      new FormData(event.currentTarget).get('message') ?? '',
    ).trim()
    if (!body) {
      return
    }
    try {
      await sendMessage.mutateAsync({ reportId, body })
      event.currentTarget.reset()
    } catch {
      /* Query error state is surfaced by the page. */
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
          <p className="eyebrow">{t('found.followUpTitle')}</p>
          <h1>{t('found.followUpSignInTitle')}</h1>
          <p>{t('found.followUpSignInBody')}</p>
          <Link className="primary-cta" to="/auth">
            {t('common.signIn')}
            <Icon name="arrow-right" />
          </Link>
        </section>
      </main>
    )
  }
  return (
    <div className="dashboard-page">
      <SiteHeader />
      <main className="dashboard-shell follow-up-shell">
        <div className="dashboard-intro">
          <div>
            <p className="eyebrow">{t('found.followUpTitle')}</p>
            <h1>{t('found.followUpPageTitle')}</h1>
            <p>{t('found.followUpPageIntro')}</p>
          </div>
        </div>
        {followUp.isLoading ? (
          <p>{t('auth.loading')}</p>
        ) : followUp.isError ? (
          <p className="form-error">{t('found.followUpLoadError')}</p>
        ) : reports.length === 0 ? (
          <section className="dashboard-empty">
            <h2>{t('found.followUpEmptyTitle')}</h2>
            <p>{t('found.followUpEmptyBody')}</p>
          </section>
        ) : (
          <div className="follow-up-list">
            {reports.map((report) => (
              <article className="follow-up-report" key={report.id}>
                <div>
                  <p className="moderation-status">
                    {t(`common.${report.species}`)} ·{' '}
                    {formatDateTime(
                      report.found_at,
                      i18n.resolvedLanguage as AppLocale,
                    )}
                  </p>
                  <h2>
                    {[report.colour, report.breed]
                      .filter(Boolean)
                      .join(' · ') || t('moderation.foundPet')}
                  </h2>
                  <p>{t(`found.custody.${report.custody_status}`)}</p>
                </div>
                {report.link?.status === 'confirmed' ? (
                  <Conversation
                    messages={messages[report.id] ?? []}
                    reportId={report.id}
                    sending={sendMessage.isPending}
                    sessionUserId={session.user.id}
                    onSend={send}
                  />
                ) : (
                  <p className="follow-up-status">
                    {report.link
                      ? t('found.followUpAwaitingOwner')
                      : t('found.followUpNoMatch')}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}

function Conversation({
  messages,
  reportId,
  sending,
  sessionUserId,
  onSend,
}: {
  messages: FollowUpMessage[]
  reportId: string
  sending: boolean
  sessionUserId: string
  onSend: (event: FormEvent<HTMLFormElement>, reportId: string) => Promise<void>
}) {
  const { t } = useTranslation()
  return (
    <section
      className="private-conversation"
      aria-label={t('found.conversationTitle')}
    >
      <h3>{t('found.conversationTitle')}</h3>
      <p>{t('found.conversationHelp')}</p>
      {messages.length > 0 && (
        <ol>
          {messages.map((message) => (
            <li
              className={message.sender_id === sessionUserId ? 'mine' : ''}
              key={message.id}
            >
              {message.body}
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={(event) => void onSend(event, reportId)}>
        <label>
          {t('found.messageLabel')}
          <textarea name="message" maxLength={1500} required rows={3} />
        </label>
        <button className="primary-cta" disabled={sending} type="submit">
          {sending ? t('found.messageSending') : t('found.messageSend')}
        </button>
      </form>
    </section>
  )
}
