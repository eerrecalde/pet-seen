import { useTranslation } from 'react-i18next'
import { Icon } from '../../components/Icon'
import { Link } from '../../components/SiteChrome'

export function FoundPetPage() { const { t } = useTranslation(); return <main className="placeholder-page"><Link className="back-link" to="/"><Icon name="arrow-left" />{t('common.backToHome')}</Link><p className="eyebrow">{t('placeholders.laterRelease')}</p><h1>{t('placeholders.foundTitle')}</h1><p>{t('placeholders.foundBody')}</p></main> }
