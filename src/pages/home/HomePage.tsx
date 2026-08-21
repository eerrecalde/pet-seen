import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  NearbyDiscoveryMap,
  type NearbyMapPoint,
} from '../../components/maps/NearbyDiscoveryMap'
import { Icon } from '../../components/Icon'
import { PetImage } from '../../components/PetImage'
import { Link, SiteFooter, SiteHeader } from '../../components/SiteChrome'
import { useNearbyDiscoveryQuery } from '../../features/public-cases/queries'

export function HomePage() {
  const { t } = useTranslation()
  const {
    data: nearbyDiscovery,
    isError,
    isPending,
  } = useNearbyDiscoveryQuery()
  const cases = nearbyDiscovery?.cases ?? []
  const sightings = nearbyDiscovery?.sightings ?? []
  const [showMap, setShowMap] = useState(false)
  const actions = [
    {
      description: t('home.missingDescription'),
      icon: 'search-eye',
      label: t('home.missingLabel'),
      to: '/lost/new',
      tone: 'lost',
    },
    {
      description: t('home.sightingDescription'),
      icon: 'eye',
      label: t('home.sightingLabel'),
      to: '/sighting/new',
      tone: 'sighting',
    },
    {
      description: t('home.foundDescription'),
      icon: 'home-heart',
      label: t('home.foundLabel'),
      to: '/found/new',
      tone: 'found',
    },
  ] as const

  const points: NearbyMapPoint[] = [
    ...cases.map((caseData) => ({
      id: caseData.public_slug,
      kind: 'case' as const,
      latitude: Number(caseData.public_latitude),
      longitude: Number(caseData.public_longitude),
      label: t('nearby.casePin', { petName: caseData.pet_name }),
    })),
    ...sightings.map((sighting) => ({
      id: sighting.sighting_id,
      kind: 'sighting' as const,
      latitude: Number(sighting.public_latitude),
      longitude: Number(sighting.public_longitude),
      label: t('nearby.sightingPin'),
    })),
  ]
  return (
    <div className="page-shell">
      <SiteHeader />
      <main>
        <section className="home-intro" aria-labelledby="actions-heading">
          <div className="section-heading">
            <p className="eyebrow">{t('home.eyebrow')}</p>
            <h1 id="actions-heading">{t('home.title')}</h1>
            <p className="intro-copy">{t('home.intro')}</p>
          </div>
          <div className="action-grid">
            {actions.map((action) => (
              <Link
                className={`action-card ${action.tone}`}
                key={action.to}
                to={action.to}
              >
                <span className="action-icon">
                  <Icon name={action.icon} />
                </span>
                <span className="action-title">{action.label}</span>
                <span className="action-copy">{action.description}</span>
                <span className="action-arrow">
                  <Icon name="arrow-right" />
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section
          className="nearby-section"
          id="nearby"
          aria-labelledby="nearby-heading"
        >
          <div className="nearby-heading">
            <div>
              <p className="eyebrow">{t('nearby.eyebrow')}</p>
              <h2 id="nearby-heading">{t('nearby.title')}</h2>
              <p>{t('nearby.intro')}</p>
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setShowMap(!showMap)}
              aria-expanded={showMap}
            >
              {showMap ? (
                <>
                  <Icon name="list-check" />
                  {t('nearby.showList')}
                </>
              ) : (
                <>
                  <Icon name="map-2" />
                  {t('nearby.showMap')}
                </>
              )}
            </button>
          </div>
          {isPending ? (
            <p className="nearby-message">{t('nearby.loading')}</p>
          ) : isError ? (
            <p className="nearby-message">{t('nearby.unavailable')}</p>
          ) : cases.length === 0 ? (
            <p className="nearby-message">{t('nearby.empty')}</p>
          ) : showMap ? (
            <>
              <div className="nearby-legend">
                <span className="missing">
                  <i />
                  {t('nearby.missingLegend')}
                </span>
                <span className="sighting">
                  <i />
                  {t('nearby.sightingLegend')}
                </span>
              </div>
              <NearbyDiscoveryMap
                points={points}
                label={t('nearby.mapLabel')}
              />
            </>
          ) : (
            <div className="nearby-list">
              {cases.map((caseData) => (
                <Link
                  key={caseData.public_slug}
                  className="nearby-case"
                  to={`/find/${caseData.public_slug}`}
                >
                  <PetImage
                    className="nearby-photo"
                    petName={caseData.pet_name}
                    species={caseData.species}
                    publicSlug={caseData.public_slug}
                  />
                  <div>
                    <p>{t('nearby.missingLabel')}</p>
                    <h3>{caseData.pet_name}</h3>
                    <span>
                      {[caseData.colour, caseData.breed]
                        .filter(Boolean)
                        .join(' · ') || t(`common.${caseData.species}`)}
                    </span>
                    <small>
                      <Icon name="map-pin-2" />
                      {caseData.last_seen_description ||
                        t('publicCase.approximateArea')}
                    </small>
                  </div>
                  <Icon name="arrow-right" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
