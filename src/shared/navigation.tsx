import type { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router'
import { localisedPath } from './paths'

export function Link({ to, ...props }: ComponentProps<typeof RouterLink>) {
  const { i18n } = useTranslation()
  return <RouterLink {...props} to={localisedPath(to.toString(), i18n.resolvedLanguage)} />
}
