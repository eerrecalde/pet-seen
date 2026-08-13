import { useTranslation } from 'react-i18next'
import { Link } from '../../components/SiteChrome'

export function NotFoundPage() { const { t } = useTranslation(); return <main className="placeholder-page"><p className="eyebrow">{t('placeholders.notFound')}</p><h1>{t('placeholders.notFoundTitle')}</h1><Link className="primary-cta" to="/">{t('common.goHome')}</Link></main> }
