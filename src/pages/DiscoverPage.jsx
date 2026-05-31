import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../services/api.js'
import { usePlatformStats } from '../hooks/usePlatformStats.js'
import './DiscoverPage.css'

const filters = ['All', 'Featured', 'Music', 'Business', 'Community', 'Workshops', 'Nightlife']

const sidePicks = [
  'Tech meetups',
  'Dinner salons',
  'Creative workshops',
  'Night markets',
  'Networking brunches',
]

export default function DiscoverPage() {
  const navigate = useNavigate()
  const [activeFilter, setActiveFilter] = useState('All')
  const [menuOpen, setMenuOpen] = useState(false)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { stats, loading: statsLoading } = usePlatformStats()

  const formatMetric = (value) => {
    const num = Number(value || 0)
    if (!Number.isFinite(num) || num <= 0) return '—'
    return num.toLocaleString('en-NG')
  }

  const highlights = [
    { label: 'Total events', value: formatMetric(stats?.totalEvents) },
    { label: 'Tickets sold', value: formatMetric(stats?.totalTicketsSold) },
    { label: 'Total votes', value: formatMetric(stats?.totalVotes) },
  ]

  useEffect(() => {
    let alive = true

    async function loadPublicEvents() {
      setLoading(true)
      setError('')

      try {
        const payload = await apiRequest('/events/public')
        if (!alive) return
        const evs = Array.isArray(payload.data?.events) ? payload.data.events : []
        setEvents(evs)
        // debug: show how many public events and whether they have cover images
        // eslint-disable-next-line no-console
        console.debug('Discover: loaded public events', evs.length, evs.map(e => ({ id: e.id, hasCover: Boolean(e.coverImage) })))
      } catch (err) {
        if (!alive) return
        setError(err.message || 'Failed to load public events')
      } finally {
        if (alive) setLoading(false)
      }
    }

    loadPublicEvents()
    return () => { alive = false }
  }, [])

  const visibleEvents = useMemo(() => {
    if (activeFilter === 'All') return events
    return events.filter(e => {
      const category = String(e.theme || e.category || '').toLowerCase()
      return category === activeFilter.toLowerCase()
    })
  }, [activeFilter, events])

  return (
    <main className="dp-page">
      <div className="dp-glow-a" aria-hidden="true" />
      <div className="dp-glow-b" aria-hidden="true" />

      {/* ── Topbar ── */}
      <header className="dp-topbar">
        <button type="button" className="dp-brand" onClick={() => navigate('/')} aria-label="NEST home">
          NEST<span className="dp-brand-star">✦</span>
        </button>

        <nav className="dp-nav" aria-label="Discover navigation">
          <button type="button" className="dp-nav-active">Discover</button>
          <button type="button" className="dp-nav-link" onClick={() => navigate('/home/calendars')}>Calendars</button>
          <button type="button" className="dp-nav-primary" onClick={() => navigate('/events/new')}>
            Create event
          </button>
          {/* Mobile hamburger */}
          <button
            type="button"
            className="dp-menu-toggle"
            aria-label="Open menu"
            onClick={() => setMenuOpen(v => !v)}
          >
            <span /><span /><span />
          </button>
        </nav>
      </header>

      {/* ── Hero ── */}
      <section className="dp-hero">
        <div className="dp-hero-copy">
          <p className="dp-kicker">Discover what&apos;s happening</p>
          <h1 className="dp-title">
            Curated events,<br />
            <em>built to browse</em> beautifully.
          </h1>
          <p className="dp-subtitle">
            Browse standout launches, intimate gatherings, and high-energy nights in a
            layout that feels closer to a magazine than a directory.
          </p>

          <div className="dp-search-row">
            <input
              type="search"
              className="dp-search-input"
              placeholder="Search cities, hosts, or event types"
              aria-label="Search events"
            />
            <button type="button" className="dp-search-btn" onClick={() => navigate('/events/new')}>
              Create your own
            </button>
          </div>

          <div className="dp-highlights">
            {highlights.map(item => (
              <article key={item.label} className="dp-highlight-card">
                <span className="dp-highlight-val">{statsLoading ? '...' : item.value}</span>
                <span className="dp-highlight-lbl">{item.label}</span>
              </article>
            ))}
          </div>
        </div>

        <aside className="dp-hero-aside" aria-label="Browse picks">
          <div className="dp-feature-panel">
            <span className="dp-feature-pill">Featured</span>
            <h2 className="dp-feature-title">A better way to find your next night out.</h2>
            <p className="dp-feature-copy">
              Explore event types that feel hand-picked, with enough breathing room to
              scan quickly and decide fast.
            </p>
            <div className="dp-side-list">
              {sidePicks.map(item => (
                <div key={item} className="dp-side-item">{item}</div>
              ))}
            </div>
          </div>
        </aside>
      </section>

      {/* ── Filters ── */}
      <div className="dp-filter-row" role="group" aria-label="Event filters">
        {filters.map(filter => (
          <button
            key={filter}
            type="button"
            className={filter === activeFilter ? 'dp-filter-active' : 'dp-filter'}
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="dp-content">

        {/* Event cards */}
        <section className="dp-event-grid" aria-label="Event listings">
          {loading && (
            <p style={{ color: 'var(--text-3)', padding: '32px 0', gridColumn: '1/-1' }}>
              Loading public events...
            </p>
          )}
          {!loading && error && (
            <p style={{ color: 'var(--text-3)', padding: '32px 0', gridColumn: '1/-1' }}>
              {error}
            </p>
          )}
          {!loading && !error && visibleEvents.length === 0 && (
            <p style={{ color: 'var(--text-3)', padding: '32px 0', gridColumn: '1/-1' }}>
              No events in this category yet.
            </p>
          )}
          {visibleEvents.map(event => (
            <article key={event.id} className="dp-event-card" onClick={() => navigate(`/public/events/${event.id}`)}>
              {event.coverImage && (
                <div
                  className="dp-card-cover"
                  style={{ backgroundImage: `url(${event.coverImage})`, backgroundPosition: 'center', backgroundSize: 'cover' }}
                />
              )}
              <div
                className="dp-card-glow"
                style={{}}
              />

              <div className="dp-card-top">
                <div>
                  <div className="dp-card-date">{formatEventDate(event.startDate)}</div>
                  <div className="dp-card-time">{formatEventTime(event.startTime, event.endTime)}</div>
                </div>
                <span className="dp-card-tag">{String(event.theme || 'Featured')}</span>
              </div>

              <h3 className="dp-card-title">{event.title}</h3>
              <p className="dp-card-summary">{event.description || 'Public event'}</p>

              <div className="dp-card-meta">
                <span>{event.location || 'Location not set'}</span>
                <span>{event.hostName || event.hostEmail || 'Creator'}</span>
                <span>{event.ticketPrice || 'Free'}</span>
              </div>

              <div className="dp-card-footer">
                <span className="dp-card-going">{event.isPublic ? 'Public' : 'Private'}</span>
                <button
                  type="button"
                  className="dp-card-btn"
                  onClick={e => { e.stopPropagation(); navigate(`/public/events/${event.id}`) }}
                >
                  View event
                </button>
              </div>
            </article>
          ))}
        </section>

        {/* Sidebar */}
        <aside className="dp-sidebar">
          <section className="dp-sidebar-panel">
            <div className="dp-sidebar-head">Popular cities</div>
            <div className="dp-city-list">
              {['Lagos', 'Abuja', 'Port Harcourt', 'Ibadan', 'Enugu'].map(city => (
                <div key={city} className="dp-city-row">
                  <span>{city}</span>
                  <span className="dp-city-live">Live</span>
                </div>
              ))}
            </div>
          </section>

          <section className="dp-sidebar-panel">
            <div className="dp-sidebar-head">Why browse here</div>
            <p className="dp-sidebar-copy">
              Discovery works best when the layout stays calm. This page keeps the
              interface simple so the events do the selling.
            </p>
            <button
              type="button"
              className="dp-sidebar-btn"
              onClick={() => navigate('/home/calendars')}
            >
              Open calendars →
            </button>
          </section>
        </aside>
      </div>
    </main>
  )
}

function formatEventDate(dateString) {
  if (!dateString) return 'Date not set'
  const eventDate = new Date(dateString)
  if (Number.isNaN(eventDate.getTime())) return dateString
  return new Intl.DateTimeFormat('en-NG', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(eventDate)
}

function formatEventTime(startTime, endTime) {
  return [startTime, endTime].filter(Boolean).join(' - ') || 'Time not set'
}