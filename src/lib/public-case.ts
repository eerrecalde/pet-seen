import type { AppLocale } from '../i18n/resources'
import { localisedPath } from './routing'

export function publicCaseUrl(slug: string, locale: AppLocale) {
  return new URL(localisedPath(`/find/${slug}`, locale), window.location.origin).toString()
}

export function socialCardUrl(slug: string) {
  const configuredBase = import.meta.env.VITE_SOCIAL_CARD_URL
  return configuredBase
    ? `${configuredBase.replace(/\/$/, '')}?slug=${encodeURIComponent(slug)}`
    : new URL('/images/generic-dog.jpg', window.location.origin).toString()
}
