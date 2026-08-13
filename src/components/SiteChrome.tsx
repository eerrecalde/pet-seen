import type { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth/useAuth'
import type { AppLocale } from '../i18n/resources'
import { localisedPath } from '../lib/routing'
import { Icon } from './Icon'

export function Link({ to, ...props }: ComponentProps<typeof RouterLink>) {
  const { i18n } = useTranslation()
  return <RouterLink {...props} to={localisedPath(to.toString(), i18n.resolvedLanguage)} />
}

export function PetSeenMark() {
  return <svg className="wordmark-mark" viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="7.5" cy="20.4" rx="5.2" ry="7" transform="rotate(-31 7.5 20.4)" /><ellipse cx="16.8" cy="9.7" rx="5.6" ry="7.3" transform="rotate(-7 16.8 9.7)" /><ellipse cx="31.2" cy="9.7" rx="5.6" ry="7.3" transform="rotate(7 31.2 9.7)" /><ellipse cx="40.5" cy="20.4" rx="5.2" ry="7" transform="rotate(31 40.5 20.4)" /><path d="M24 25.8c-5.1 0-8.4 4-11.4 7.8-2.8 3.4-6 5.2-6 8.8 0 3.7 3.5 6 7.8 6 3.7 0 5.7-1.6 9.6-1.6s5.9 1.6 9.6 1.6c4.3 0 7.8-2.3 7.8-6 0-3.6-3.2-5.4-6-8.8-3-3.8-6.3-7.8-11.4-7.8Z" /></svg>
}

export function LanguagePicker() {
  const { i18n, t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()

  return <label className="language-picker"><span className="sr-only">{t('language.label')}</span><Icon name="global" /><select aria-label={t('language.label')} value={i18n.resolvedLanguage} onChange={(event) => { const locale = event.target.value as AppLocale; const path = location.pathname.replace(/^\/es(?=\/|$)/, '') || '/'; navigate(`${localisedPath(path, locale)}${location.search}${location.hash}`) }}><option value="en-GB">{t('language.english')}</option><option value="es-419">{t('language.spanish')}</option></select></label>
}

export function SiteHeader() {
  const { t } = useTranslation()
  const { session } = useAuth()
  return <header className="site-header"><Link className="wordmark" to="/" aria-label={t('common.petSeenHome')}><PetSeenMark />Pet Seen</Link><nav aria-label={t('common.petSeenHome')}><Link className="nearby-link" to="/#nearby"><Icon name="map-pin-2" />{t('common.nearbyPets')}</Link><LanguagePicker /><Link className="sign-in" to={session ? '/dashboard' : '/auth'}><Icon name="user-3" />{session ? t('common.account') : t('common.signIn')}</Link></nav></header>
}

export function SiteFooter() {
  const { t } = useTranslation()
  return <footer><span>Pet Seen</span><span>{t('footer')}</span></footer>
}

export function Progress({ label, total, current = 1 }: { label: string, total: number, current?: number }) {
  const { t } = useTranslation()
  const step = t('missingCase.step', { current, total })
  return <div className="progress" aria-label={step}><span className="progress-label">{label}</span><span>{step}</span><div className="progress-track"><span style={{ width: `${(current / total) * 100}%` }} /></div></div>
}

export function SimpleHeader({ onExit }: { onExit?: () => Promise<boolean> }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  async function leaveFlow(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!onExit) return
    event.preventDefault()
    if (await onExit()) navigate(localisedPath('/', i18n.resolvedLanguage))
  }

  return <header className="simple-header"><Link className="wordmark" to="/" aria-label={t('common.petSeenHome')} onClick={leaveFlow}><PetSeenMark />Pet Seen</Link><LanguagePicker /><Link className="back-link small-back" to="/" onClick={leaveFlow}><Icon name="arrow-left" />{t('common.backToHome')}</Link></header>
}
