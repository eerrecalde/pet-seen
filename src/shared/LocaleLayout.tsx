import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useParams } from 'react-router'
import { defaultLocale, localeFromUrlSegment } from '../i18n'

export function LocaleLayout() {
  const { locale } = useParams()
  const { i18n } = useTranslation()
  useEffect(() => { void i18n.changeLanguage(localeFromUrlSegment(locale) ?? defaultLocale) }, [i18n, locale])
  return <Outlet />
}
