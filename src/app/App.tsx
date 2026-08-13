import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Route, Routes } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { Icon } from '../components'
import { LocaleLayout } from '../shared/LocaleLayout'
import { AuthPlaceholder, HomePage, MissingCasePage, ModerationPage, NotFound, OwnerDashboardPage, PosterPage, PublicCasePage, ReportPlaceholder, SightingPage } from '../pages/routes'

export function App() {
  const { t } = useTranslation()
  const { acknowledgeSignIn, justSignedIn } = useAuth()
  useEffect(() => { if (!justSignedIn) return; const timeout = window.setTimeout(acknowledgeSignIn, 5000); return () => window.clearTimeout(timeout) }, [acknowledgeSignIn, justSignedIn])
  return <>{justSignedIn && <div className="sign-in-toast" role="status"><Icon name="check-line" />{t('auth.toast')}</div>}<Routes><Route path="/:locale?" element={<LocaleLayout />}><Route index element={<HomePage />} /><Route path="lost/new" element={<MissingCasePage />} /><Route path="dashboard" element={<OwnerDashboardPage />} /><Route path="moderation" element={<ModerationPage />} /><Route path="sighting/new" element={<SightingPage />} /><Route path="find/:slug/poster" element={<PosterPage />} /><Route path="find/:slug" element={<PublicCasePage />} /><Route path="auth" element={<AuthPlaceholder />} /><Route path="found/new" element={<ReportPlaceholder />} /><Route path="*" element={<NotFound />} /></Route></Routes></>
}
