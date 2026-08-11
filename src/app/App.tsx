import { Link, Route, Routes } from 'react-router'

const actions = [
  {
    description: 'Create a secure public case and get the word out quickly.',
    icon: 'search-eye',
    label: 'I lost a pet',
    to: '/lost/new',
    tone: 'lost',
  },
  {
    description: 'A quick photo, place and time could make all the difference.',
    icon: 'eye',
    label: 'I saw a pet',
    to: '/sighting/new',
    tone: 'sighting',
  },
  {
    description: 'Tell the community that a pet is safe and needs its family.',
    icon: 'home-heart',
    label: 'I found a pet',
    to: '/found/new',
    tone: 'found',
  },
] as const

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/auth" element={<AuthPlaceholder />} />
      <Route path="/:reportType/new" element={<ReportPlaceholder />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

function HomePage() {
  return (
    <div className="page-shell">
      <header className="site-header">
        <Link className="wordmark" to="/" aria-label="Pet Seen home">
          <PetSeenMark />
          Pet Seen
        </Link>
        <nav aria-label="Main navigation">
          <a className="nearby-link" href="#nearby"><Icon name="map-pin-2" />Nearby pets</a>
          <Link className="sign-in" to="/auth"><Icon name="user-3" />Sign in</Link>
        </nav>
      </header>

      <main>
        <section className="action-section" aria-labelledby="actions-heading">
          <div className="section-heading">
            <p className="eyebrow">Pet Seen</p>
            <h1 id="actions-heading">What happened?</h1>
          </div>
          <div className="action-grid">
            {actions.map((action) => (
              <Link className={`action-card ${action.tone}`} key={action.to} to={action.to}>
                <span className="action-icon" aria-hidden="true"><Icon name={action.icon} /></span>
                <span className="action-title">{action.label}</span>
                <span className="action-copy">{action.description}</span>
                <span className="action-arrow" aria-hidden="true"><Icon name="arrow-right" /></span>
              </Link>
            ))}
          </div>
        </section>

        <section className="about-section" aria-labelledby="about-heading">
          <div>
            <p className="eyebrow">How Pet Seen helps</p>
            <h2 id="about-heading">Quick reports, shared locally.</h2>
          </div>
          <div className="about-points">
            <p><Icon name="time" /><span><strong>Report quickly.</strong> Share the pet, place and time while the information is fresh.</span></p>
            <p><Icon name="shield-check" /><span><strong>Protect privacy.</strong> Public maps show an approximate area; exact locations stay private.</span></p>
            <p><Icon name="community" /><span><strong>Help neighbours act.</strong> A shared case gives people one clear way to report a sighting.</span></p>
          </div>
        </section>

        <section className="nearby-section" id="nearby" aria-labelledby="nearby-heading">
          <div>
            <p className="eyebrow">Coming in the controlled beta</p>
            <h2 id="nearby-heading">Missing pets near you</h2>
            <p>Choose a town or postcode to see active cases near you.</p>
          </div>
          <button type="button" className="secondary-button"><Icon name="map-pin" />Choose an area</button>
        </section>
      </main>

      <footer>
        <span>Pet Seen</span>
        <span>Bringing pets home, together.</span>
      </footer>
    </div>
  )
}

function PetSeenMark() {
  return (
    <svg className="wordmark-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <ellipse cx="7.5" cy="20.4" rx="5.2" ry="7" transform="rotate(-31 7.5 20.4)" />
      <ellipse cx="16.8" cy="9.7" rx="5.6" ry="7.3" transform="rotate(-7 16.8 9.7)" />
      <ellipse cx="31.2" cy="9.7" rx="5.6" ry="7.3" transform="rotate(7 31.2 9.7)" />
      <ellipse cx="40.5" cy="20.4" rx="5.2" ry="7" transform="rotate(31 40.5 20.4)" />
      <path d="M24 25.8c-5.1 0-8.4 4-11.4 7.8-2.8 3.4-6 5.2-6 8.8 0 3.7 3.5 6 7.8 6 3.7 0 5.7-1.6 9.6-1.6s5.9 1.6 9.6 1.6c4.3 0 7.8-2.3 7.8-6 0-3.6-3.2-5.4-6-8.8-3-3.8-6.3-7.8-11.4-7.8Z" />
    </svg>
  )
}

function Icon({ name }: { name: string }) {
  return <i className={`ri-${name}-line`} aria-hidden="true" />
}

function ReportPlaceholder() {
  return (
    <main className="placeholder-page">
      <Link className="back-link" to="/"><Icon name="arrow-left" />Back to Pet Seen</Link>
      <p className="eyebrow">Release 1</p>
      <h1>This report flow is next.</h1>
      <p>We are laying the foundation for safe, fast pet reports first.</p>
    </main>
  )
}

function AuthPlaceholder() {
  return (
    <main className="placeholder-page">
      <Link className="back-link" to="/"><Icon name="arrow-left" />Back to Pet Seen</Link>
      <p className="eyebrow">Account access</p>
      <h1>Sign in will use a secure email link.</h1>
      <p>You will not need a password. This is being built with the missing-pet case flow.</p>
    </main>
  )
}

function NotFound() {
  return (
    <main className="placeholder-page">
      <p className="eyebrow">Not found</p>
      <h1>This page is not here yet.</h1>
      <Link className="primary-cta" to="/">Go home</Link>
    </main>
  )
}
