import { defaultLocale, localeUrlPrefix } from '../i18n'
import type { AppLocale } from '../i18n/resources'

export function localisedPath(path: string, locale: string | undefined) {
  return `${localeUrlPrefix((locale ?? defaultLocale) as AppLocale)}${path}`
}
