import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { resources, type AppLocale } from './resources'

export const defaultLocale = 'en-GB'
export const supportedLocales = ['en-GB', 'es-419'] as const
export function isSupportedLocale(
  locale: string | undefined,
): locale is AppLocale {
  return locale !== undefined && supportedLocales.includes(locale as AppLocale)
}

export function localeFromUrlSegment(
  segment: string | undefined,
): AppLocale | undefined {
  return segment === 'es' ? 'es-419' : undefined
}

export function localeUrlPrefix(locale: AppLocale) {
  return locale === 'es-419' ? '/es' : ''
}

const initialLocale =
  localeFromUrlSegment(window.location.pathname.split('/')[1]) ?? defaultLocale

i18n.use(initReactI18next).init({
  resources,
  lng: initialLocale,
  fallbackLng: defaultLocale,
  interpolation: { escapeValue: false },
  returnNull: false,
})

i18n.on('languageChanged', (locale) => {
  document.documentElement.lang = locale
})

document.documentElement.lang = i18n.language

export default i18n
