import { useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import BackButton from '../components/BackButton.jsx'

export default function ThankYouPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()

  const pathname = String(location.pathname || '').toLowerCase()
  const kind = searchParams.get('type') || (pathname.includes('vote') ? 'vote' : 'ticket')
  const backUrl = searchParams.get('back') || '/events'
  const ticketUrl = searchParams.get('ticketUrl') || ''
  const title = searchParams.get('title') || (kind === 'vote' ? 'Thank you for voting' : 'Thank you for your payment')
  const subtitle = searchParams.get('subtitle') || (kind === 'vote'
    ? 'Your vote has been recorded successfully. You can vote for a friend next.'
    : 'Your ticket is confirmed. You can reserve another one for a friend next.')

  const ctaLabel = useMemo(() => (kind === 'vote' ? 'Revote for a friend' : 'Pay for a friend'), [kind])
  const hasTicketAction = kind === 'ticket' && Boolean(ticketUrl)

  return (
    <div style={styles.page}>
      <main style={styles.main}>
        <BackButton fallback="/" style={styles.backButton} />
        <section style={styles.card}>
          <div style={styles.badge}>{kind === 'vote' ? 'Vote Complete' : 'Ticket Complete'}</div>
          <h1 style={styles.title}>{title}</h1>
          <p style={styles.subtitle}>{subtitle}</p>

          <div style={styles.actions}>
            <button type="button" style={styles.primaryBtn} onClick={() => navigate(backUrl)}>
              {ctaLabel}
            </button>
            {hasTicketAction && (
              <button type="button" style={styles.ticketBtn} onClick={() => navigate(ticketUrl)}>
                View Ticket / Download QR
              </button>
            )}
            <button type="button" style={styles.secondaryBtn} onClick={() => navigate('/events')}>
              Back to Events
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: 'radial-gradient(circle at top, rgba(167,139,250,0.18), transparent 32%), linear-gradient(180deg, #0f0f13 0%, #09090d 100%)',
    color: '#f1f1f5',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    padding: 24,
  },
  main: { width: '100%', maxWidth: 760 },
  backButton: { marginBottom: 16 },
  card: {
    padding: '40px 28px',
    borderRadius: 28,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
    textAlign: 'center',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '7px 12px',
    borderRadius: 999,
    background: 'rgba(167,139,250,0.12)',
    color: '#ddd6fe',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    marginBottom: 18,
  },
  title: { margin: 0, fontSize: 'clamp(30px, 5vw, 54px)', letterSpacing: '-.04em' },
  subtitle: { margin: '12px auto 0', maxWidth: 560, color: '#b8b8c6', fontSize: 16, lineHeight: 1.7 },
  actions: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 28,
  },
  primaryBtn: {
    border: 'none',
    borderRadius: 14,
    padding: '12px 18px',
    background: '#f1f1f5',
    color: '#111',
    fontWeight: 800,
    cursor: 'pointer',
    minWidth: 190,
  },
  ticketBtn: {
    border: '1px solid rgba(167,139,250,0.24)',
    borderRadius: 14,
    padding: '12px 18px',
    background: 'rgba(167,139,250,0.12)',
    color: '#e9d5ff',
    fontWeight: 800,
    cursor: 'pointer',
    minWidth: 220,
  },
  secondaryBtn: {
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: '12px 18px',
    background: 'rgba(255,255,255,0.04)',
    color: '#f1f1f5',
    fontWeight: 700,
    cursor: 'pointer',
    minWidth: 160,
  },
}
