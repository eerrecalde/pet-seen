import type { AppLocale } from './resources'

export function formatDateTime(
  value: Date | number | string,
  locale: AppLocale,
) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function formatNumber(value: number, locale: AppLocale) {
  return new Intl.NumberFormat(locale).format(value)
}
