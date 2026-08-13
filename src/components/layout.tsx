import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import type { AppLocale } from '../i18n/resources'
import { useAuth } from '../auth/useAuth'
import { Link } from '../shared/navigation'
import { localisedPath } from '../shared/paths'
import { Icon, PetSeenMark } from './ui'

export function LanguagePicker() { const { i18n, t } = useTranslation(); const location = useLocation(); const navigate = useNavigate(); return <label className="language-picker"><span className="sr-only">{t('language.label')}</span><Icon name="global" /><select aria-label={t('language.label')} value={i18n.resolvedLanguage} onChange={(event) => { const locale = event.target.value as AppLocale; const path = location.pathname.replace(/^\/es(?=\/|$)/, '') || '/'; navigate(`${localisedPath(path, locale)}${location.search}${location.hash}`); }}><option value="en-GB">{t('language.english')}</option><option value="es-419">{t('language.spanish')}</option></select></label> }
export function SiteHeader() { const { t } = useTranslation(); const { session } = useAuth(); return <header className="site-header"><Link className="wordmark" to="/" aria-label={t('common.petSeenHome')}><PetSeenMark />Pet Seen</Link><nav aria-label={t('common.petSeenHome')}><Link className="nearby-link" to="/#nearby"><Icon name="map-pin-2" />{t('common.nearbyPets')}</Link><LanguagePicker /><Link className="sign-in" to={session ? '/dashboard' : '/auth'}><Icon name="user-3" />{session ? t('common.account') : t('common.signIn')}</Link></nav></header> }
export function SimpleHeader({ onExit }: { onExit?: () => Promise<boolean> }) { const { t, i18n } = useTranslation(); const navigate = useNavigate(); async function leaveFlow(event: MouseEvent<HTMLAnchorElement>) { if (!onExit) return; event.preventDefault(); if (await onExit()) navigate(localisedPath('/', i18n.resolvedLanguage)) } return <header className="simple-header"><Link className="wordmark" to="/" aria-label={t('common.petSeenHome')} onClick={leaveFlow}><PetSeenMark />Pet Seen</Link><LanguagePicker /><Link className="back-link small-back" to="/" onClick={leaveFlow}><Icon name="arrow-left" />{t('common.backToHome')}</Link></header> }
export function SiteFooter() { const { t } = useTranslation(); return <footer><span>Pet Seen</span><span>{t('footer')}</span></footer> }
