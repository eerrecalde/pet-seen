import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { Icon } from '../../components/Icon'
import { PetImage } from '../../components/PetImage'
import { PublicCaseNotice } from '../../components/PublicCaseNotice'
import { Link, PetSeenMark } from '../../components/SiteChrome'
import { formatDateTime } from '../../i18n/format'
import type { AppLocale } from '../../i18n/resources'
import { usePublicCaseQuery } from '../../features/public-cases/queries'
import type { PublicCase } from '../../features/public-cases/types'
import { publicCaseUrl } from '../../lib/public-case'
import { useQrCode } from '../../hooks/useQrCode'

export function PosterPage() {
  const { t, i18n } = useTranslation()
  const { slug } = useParams()
  const { data: caseData, isError, isPending } = usePublicCaseQuery(slug)
  if (!caseData)
    return (
      <main className="poster-page">
        <PublicCaseNotice
          title={
            isPending
              ? t('publicCase.loadingTitle')
              : isError
                ? t('publicCase.unavailableTitle')
                : t('publicCase.notFoundTitle')
          }
          body={
            isPending
              ? t('publicCase.loadingBody')
              : isError
                ? t('publicCase.unavailableBody')
                : t('publicCase.notFoundBody')
          }
        />
      </main>
    )
  return (
    <Poster caseData={caseData} locale={i18n.resolvedLanguage as AppLocale} />
  )
}

function Poster({
  caseData,
  locale,
}: {
  caseData: PublicCase
  locale: AppLocale
}) {
  const { t } = useTranslation()
  const url = publicCaseUrl(caseData.public_slug, locale)
  const qrCode = useQrCode(url)
  const title =
    caseData.title || t('publicCase.title', { petName: caseData.pet_name })
  return (
    <main className="poster-page">
      <div className="poster-toolbar">
        <Link className="back-link" to={`/find/${caseData.public_slug}`}>
          <Icon name="arrow-left" />
          {t('common.backToCases')}
        </Link>
        <button
          className="primary-cta"
          type="button"
          onClick={() => window.print()}
        >
          <Icon name="printer" />
          {t('publicCase.print')}
        </button>
      </div>
      <article
        className="poster"
        aria-label={t('publicCase.posterLabel', { petName: caseData.pet_name })}
      >
        <header>
          <PetSeenMark />
          <span>Pet Seen</span>
        </header>
        <p className="poster-alert">{t('publicCase.posterAlert')}</p>
        <h1>{title}</h1>
        <PetImage
          className="poster-photo"
          petName={caseData.pet_name}
          species={caseData.species}
          publicSlug={caseData.public_slug}
        />
        <p className="poster-description">
          {[caseData.colour, caseData.breed].filter(Boolean).join(' · ') ||
            caseData.pet_description ||
            t('publicCase.description', { petName: caseData.pet_name })}
        </p>
        <dl>
          <div>
            <dt>{t('publicCase.lastSeen')}</dt>
            <dd>
              {caseData.last_seen_at
                ? formatDateTime(caseData.last_seen_at, locale)
                : t('publicCase.lastSeenUnknown')}
            </dd>
          </div>
          <div>
            <dt>{t('publicCase.area')}</dt>
            <dd>
              {caseData.last_seen_description ||
                t('publicCase.approximateArea')}
            </dd>
          </div>
        </dl>
        <footer className="poster-qr">
          <img
            src={qrCode}
            alt={t('publicCase.qrAlt', { petName: caseData.pet_name })}
          />
          <div>
            <strong>{t('publicCase.qrTitle')}</strong>
            <p>{t('publicCase.qrBody')}</p>
            <span>{url}</span>
          </div>
        </footer>
      </article>
    </main>
  )
}
