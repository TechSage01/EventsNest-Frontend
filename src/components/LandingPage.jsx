import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlatformStats } from '../hooks/usePlatformStats.js'
import screenImage from '../assets/screen.png'
import heroImage from '../assets/hero.png'
import phoneVideo from '../assets/phone-dark.webm'
import './LandingPage.css'

const featureCards = [
  {
    icon: '✦',
    title: 'Beautiful event pages',
    copy: 'Create clean, focused pages that look premium from the first scroll.',
  },
  {
    icon: '◈',
    title: 'Invites people actually open',
    copy: 'Share one link for RSVP, tickets, and event details without clutter.',
  },
  {
    icon: '◎',
    title: 'Simple day-of flow',
    copy: 'Keep attendees organized with a landing page that stays calm and readable.',
  },
]

const steps = [
  {
    number: '01',
    title: 'Design the page',
    copy: 'Set the mood, add the details, and keep the focus on the event.',
  },
  {
    number: '02',
    title: 'Share the invite',
    copy: 'Send one polished link that works for social, email, and direct messages.',
  },
  {
    number: '03',
    title: 'Run the night',
    copy: 'Use the same page to guide guests from discovery to check-in.',
  },
]

const tags = ['Launches', 'Meetups', 'Parties', 'Conferences', 'Workshops', 'Community']

function formatNigeriaTime(date) {
  return new Intl.DateTimeFormat('en-NG', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Africa/Lagos',
    timeZoneName: 'short',
  }).format(date)
}

function LandingPage() {
  const [lagosTime, setLagosTime] = useState(() => formatNigeriaTime(new Date()))
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const { stats, loading: statsLoading, error: statsError } = usePlatformStats()

  const formatMetric = (value) => {
    const num = Number(value || 0)
    if (!Number.isFinite(num) || num <= 0) return '—'
    return num.toLocaleString('en-NG')
  }

  const statsItems = [
    { label: 'Events hosted', value: formatMetric(stats?.totalEvents) },
    { label: 'Tickets sold', value: formatMetric(stats?.totalTicketsSold) },
    { label: 'Total votes', value: formatMetric(stats?.totalVotes) },
  ]

  useEffect(() => {
    const closeMenuOnResize = () => {
      if (window.innerWidth > 425) setMenuOpen(false)
    }

    const updateClock = () => setLagosTime(formatNigeriaTime(new Date()))
    updateClock()
    const timerId = window.setInterval(updateClock, 60_000)
    window.addEventListener('resize', closeMenuOnResize)

    return () => {
      window.clearInterval(timerId)
      window.removeEventListener('resize', closeMenuOnResize)
    }
  }, [])

  return (
    <main className="ls-shell">

      {/* ── TOPBAR ── */}
      <header className="ls-topbar">
        <button className="ls-brand" type="button" onClick={() => navigate('/home')} aria-label="EventsNest home">
          <img className="ls-brand-mark" src={screenImage} alt="" aria-hidden="true" />
          <span className="ls-brand-name">EventsNest</span>
        </button>

        <nav className={`ls-topnav ${menuOpen ? 'is-open' : ''}`} aria-label="Primary">
          <span className="ls-clock">
            <span className="ls-clock-dot" />
            {lagosTime}
          </span>
          <button type="button" className="ls-nav-link" onClick={() => navigate('/discover')}>Discover</button>
          <button type="button" className="ls-nav-link" onClick={() => navigate('/discover')}>Features</button>
          <button type="button" className="ls-signin" onClick={() => navigate('/signup')}>Sign in</button>
        </nav>

        <button
          type="button"
          className={`ls-menu-toggle ${menuOpen ? 'is-open' : ''}`}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      {/* ── HERO ── */}
      <section className="ls-hero">
        <div className="ls-hero-copy">
          <p className="ls-eyebrow">
            <span className="ls-eyebrow-dot" />
            A premium home for your event brand
          </p>
          <h1 className="ls-h1">
            Delightful<br />
            <span className="ls-h1-accent">events</span><br />
            start here.
          </h1>
          <p className="ls-lede">
            Set up an event page, invite friends, and sell tickets from one
            clean, cinematic home. Keep the experience simple for guests and
            polished on every device.
          </p>
          <div className="ls-hero-actions">
            <button type="button" className="ls-btn-primary" onClick={() => navigate('/signup')}>
              Create your first event
              <span className="ls-btn-arrow">→</span>
            </button>
            <button type="button" className="ls-btn-ghost" onClick={() => navigate('/discover')}>
              Browse events
            </button>
          </div>

          <div className="ls-stats-row">
            {statsItems.map((item, index) => (
              <div key={item.label} style={{ display: 'contents' }}>
                <div className="ls-stat">
                  <strong>{statsLoading ? '...' : item.value}</strong>
                  <span>{item.label}</span>
                </div>
                {index < statsItems.length - 1 && <div className="ls-stat-divider" />}
              </div>
            ))}
            {!statsLoading && statsError && (
              <div className="ls-stat">
                <strong>—</strong>
                <span>Stats unavailable</span>
              </div>
            )}
          </div>
        </div>

        <div className="ls-hero-media" aria-label="Event preview">
          <div className="ls-media-grid-bg" aria-hidden="true" />

          <div className="ls-floating-pill ls-pill-top">
            <span className="ls-pill-live">LIVE</span>
            <span>Sunset Sessions · Lagos</span>
          </div>

          <div className="ls-phone-frame">
            <div className="ls-phone-notch" />
            <video className="ls-phone-video" autoPlay loop muted playsInline preload="auto">
              <source src={phoneVideo} type="video/webm" />
            </video>
          </div>

          <div className="ls-floating-card">
            <div className="ls-fc-row">
              <div className="ls-fc-avatar">SS</div>
              <div>
                <p className="ls-fc-name">Sunset Sessions</p>
                <p className="ls-fc-sub">248 confirmed · Tickets live</p>
              </div>
            </div>
            <div className="ls-fc-bar">
              <div className="ls-fc-bar-fill" style={{ width: '82%' }} />
            </div>
            <p className="ls-fc-pct">82% capacity</p>
          </div>
        </div>
      </section>

      <div className={`ls-mobile-menu ${menuOpen ? 'is-open' : ''}`} aria-hidden={!menuOpen}>
        <button type="button" onClick={() => { setMenuOpen(false); navigate('/discover') }}>Discover</button>
        <button type="button" onClick={() => { setMenuOpen(false); navigate('/discover') }}>Features</button>
        <button type="button" onClick={() => { setMenuOpen(false); navigate('/signup') }}>Sign in</button>
      </div>

      {/* ── TRUST STRIP ── */}
      <div className="ls-trust-strip" aria-label="Event types">
        {[...tags, ...tags].map((tag, i) => (
          <span key={i} className="ls-trust-tag">{tag}</span>
        ))}
      </div>

      {/* ── FEATURES ── */}
      <section className="ls-features">
        <div className="ls-section-label">
          <span className="ls-section-line" />
          <span>Why it feels good</span>
          <span className="ls-section-line" />
        </div>
        <h2 className="ls-section-h2">Built to feel calm, modern, and expensive.</h2>
        <p className="ls-section-sub">
          The layout keeps the visual language dark and cinematic so the event content
          stays in the spotlight instead of fighting with the interface.
        </p>

        <div className="ls-feature-grid">
          {featureCards.map((card) => (
            <article className="ls-feature-card" key={card.title}>
              <span className="ls-feature-icon">{card.icon}</span>
              <h3 className="ls-feature-title">{card.title}</h3>
              <p className="ls-feature-copy">{card.copy}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── WORKFLOW ── */}
      <section className="ls-workflow">
        <div className="ls-workflow-left">
          <div className="ls-section-label">
            <span className="ls-section-line" />
            <span>How it comes together</span>
            <span className="ls-section-line" />
          </div>
          <h2 className="ls-section-h2">Everything on one page, without the page feeling crowded.</h2>
          <p className="ls-section-sub">
            For launches, club nights, conferences, or workshops. Keep the content
            structured, then let the visuals do the heavy lifting.
          </p>

          <div className="ls-steps">
            {steps.map((step, i) => (
              <article className="ls-step" key={step.number}>
                <div className="ls-step-num-col">
                  <span className="ls-step-num">{step.number}</span>
                  {i < steps.length - 1 && <span className="ls-step-connector" />}
                </div>
                <div className="ls-step-body">
                  <h4 className="ls-step-title">{step.title}</h4>
                  <p className="ls-step-copy">{step.copy}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="ls-showcase">
          <div className="ls-showcase-header">
            <span className="ls-showcase-live">
              <span className="ls-clock-dot" />
              Tonight in Lagos
            </span>
            <span className="ls-showcase-time">7:00 PM</span>
          </div>

          <div className="ls-showcase-art">
            <img src={heroImage} alt="EventsNest hero artwork" />
            <div className="ls-showcase-art-glow" aria-hidden="true" />
          </div>

          <h4 className="ls-showcase-title">Sunset Sessions</h4>
          <p className="ls-showcase-sub">Music, networking, and a clean RSVP flow for 300+ guests.</p>

          <div className="ls-showcase-meta">
            <div className="ls-meta-item">
              <span className="ls-meta-label">Guests</span>
              <span className="ls-meta-val">248</span>
            </div>
            <div className="ls-meta-item">
              <span className="ls-meta-label">Status</span>
              <span className="ls-meta-val ls-meta-live">Live</span>
            </div>
            <div className="ls-meta-item">
              <span className="ls-meta-label">Capacity</span>
              <span className="ls-meta-val">82%</span>
            </div>
          </div>

          <button type="button" className="ls-showcase-btn" onClick={() => navigate('/signup')}>
            Get tickets →
          </button>
        </aside>
      </section>

      {/* ── CTA ── */}
      <section className="ls-cta">
        <div className="ls-cta-inner">
          <p className="ls-eyebrow">
            <span className="ls-eyebrow-dot" />
            Ready to go?
          </p>
          <h2 className="ls-cta-h2">Your next event deserves a premium home.</h2>
          <button type="button" className="ls-btn-primary ls-btn-lg" onClick={() => navigate('/signup')}>
            Create your first event
            <span className="ls-btn-arrow">→</span>
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="ls-footer">
        <div className="ls-footer-brand">
          <img className="ls-brand-mark" src={screenImage} alt="" aria-hidden="true" />
          <strong>EventsNest</strong>
          <p>Modern event pages with a premium first impression.</p>
        </div>
        <nav className="ls-footer-nav" aria-label="Footer">
          <button type="button" onClick={() => navigate('/discover')}>Discover</button>
          <button type="button" onClick={() => navigate('/discover')}>Features</button>
          <button type="button" onClick={() => navigate('/signup')}>Create</button>
          <button type="button" onClick={() => navigate('/signup')}>Sign in</button>
        </nav>
        <p className="ls-footer-copy">© 2025 EventsNest · Lagos, Nigeria</p>
      </footer>
    </main>
  )
}

export default LandingPage