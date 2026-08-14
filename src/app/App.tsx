import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Route, Routes, useLocation } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { Icon } from '../components/Icon'
import { AuthPage } from '../pages/auth/AuthPage'
import { OwnerDashboardPage } from '../pages/dashboard/OwnerDashboardPage'
import { FoundPetPage } from '../pages/found/FoundPetPage'
import { FoundPetFollowUpPage } from '../pages/found/FoundPetFollowUpPage'
import { HomePage } from '../pages/home/HomePage'
import { MissingCasePage } from '../pages/missing-case/MissingCasePage'
import { ModerationPage } from '../pages/moderation/ModerationPage'
import { NotFoundPage } from '../pages/not-found/NotFoundPage'
import { PosterPage } from '../pages/poster/PosterPage'
import { PublicCasePage } from '../pages/public-case/PublicCasePage'
import { SightingPage } from '../pages/sighting/SightingPage'
import { LocaleLayout } from './LocaleLayout'

export function App() {
  const { t } = useTranslation()
  const { acknowledgeSignIn, justSignedIn } = useAuth()
  const location = useLocation()
  const isInitialRoute = useRef(true)

  useEffect(() => {
    if (!justSignedIn) return
    const timeout = window.setTimeout(acknowledgeSignIn, 5_000)
    return () => window.clearTimeout(timeout)
  }, [acknowledgeSignIn, justSignedIn])

  useEffect(() => {
    const main = document.querySelector<HTMLElement>('main')
    if (!main) return
    main.id = 'main-content'
    main.tabIndex = -1
    if (isInitialRoute.current) {
      isInitialRoute.current = false
      return
    }
    if (location.hash !== '#main-content') main.focus({ preventScroll: true })
  }, [location.hash, location.pathname])

  return <><a className="skip-link" href="#main-content">{t('common.skipToContent')}</a><>{justSignedIn && <div className="sign-in-toast" role="status"><Icon name="check-line" />{t('auth.toast')}</div>}</><Routes><Route path="/:locale?" element={<LocaleLayout />}><Route index element={<HomePage />} /><Route path="lost/new" element={<MissingCasePage />} /><Route path="dashboard" element={<OwnerDashboardPage />} /><Route path="moderation" element={<ModerationPage />} /><Route path="sighting/new" element={<SightingPage />} /><Route path="find/:slug/poster" element={<PosterPage />} /><Route path="find/:slug" element={<PublicCasePage />} /><Route path="auth" element={<AuthPage />} /><Route path="found/new" element={<FoundPetPage />} /><Route path="found/follow-up" element={<FoundPetFollowUpPage />} /><Route path="*" element={<NotFoundPage />} /></Route></Routes></>
}
