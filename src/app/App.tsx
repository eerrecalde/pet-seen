import { Link, Route, Routes } from 'react-router'

const actions = [
  {
    description: 'Create a secure public case and get the word out quickly.',
    icon: '♥',
    label: 'I lost a pet',
    to: '/lost/new',
    tone: 'lost',
  },
  {
    description: 'A quick photo, place and time could make all the difference.',
    icon: '●',
    label: 'I saw a pet',
    to: '/sighting/new',
    tone: 'sighting',
  },
  {
    description: 'Tell the community that a pet is safe and needs its family.',
    icon: '⌂',
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
          <span className="wordmark-mark" aria-hidden="true">⌁</span>
          Pet Seen
        </Link>
        <nav aria-label="Main navigation">
          <a href="#nearby">Nearby pets</a>
          <Link className="sign-in" to="/auth">Sign in</Link>
        </nav>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-heading">
          <div className="hero-copy">
            <p className="eyebrow">A little help can bring them home</p>
            <h1 id="hero-heading">Every pet deserves to be seen.</h1>
            <p className="hero-lede">
              Pet Seen helps neighbours share missing-pet cases and quick sightings,
              so owners can act when it matters most.
            </p>
            <Link className="primary-cta" to="/lost/new">
              Report a missing pet <span aria-hidden="true">→</span>
            </Link>
          </div>
          <aside className="safety-note" aria-label="Privacy promise">
            <span className="safety-icon" aria-hidden="true">♢</span>
            <div>
              <strong>Made with care</strong>
              <p>Public maps show an approximate area. Exact locations stay private.</p>
            </div>
          </aside>
        </section>

        <section className="action-section" aria-labelledby="actions-heading">
          <div className="section-heading">
            <p className="eyebrow">How can we help?</p>
            <h2 id="actions-heading">Start with what you know</h2>
          </div>
          <div className="action-grid">
            {actions.map((action) => (
              <Link className={`action-card ${action.tone}`} key={action.to} to={action.to}>
                <span className="action-icon" aria-hidden="true">{action.icon}</span>
                <span className="action-title">{action.label}</span>
                <span className="action-copy">{action.description}</span>
                <span className="action-arrow" aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="nearby-section" id="nearby" aria-labelledby="nearby-heading">
          <div>
            <p className="eyebrow">Coming in the controlled beta</p>
            <h2 id="nearby-heading">Missing pets near you</h2>
            <p>Choose a town or postcode to see active cases near you.</p>
          </div>
          <button type="button" className="secondary-button">Choose an area</button>
        </section>
      </main>

      <footer>
        <span>Pet Seen</span>
        <span>Bringing pets home, together.</span>
      </footer>
    </div>
  )
}

function ReportPlaceholder() {
  return (
    <main className="placeholder-page">
      <Link className="back-link" to="/">← Back to Pet Seen</Link>
      <p className="eyebrow">Release 1</p>
      <h1>This report flow is next.</h1>
      <p>We are laying the foundation for safe, fast pet reports first.</p>
    </main>
  )
}

function AuthPlaceholder() {
  return (
    <main className="placeholder-page">
      <Link className="back-link" to="/">← Back to Pet Seen</Link>
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
