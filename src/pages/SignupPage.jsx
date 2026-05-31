import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest, getFriendlyErrorMessage } from '../services/api.js'

const benefits = [
  { value: '01', label: 'Fast one-time code' },
  { value: '24/7', label: 'Works on any device' },
  { value: '∞', label: 'Re-use the same invite flow' },
]

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 1024 : window.innerWidth))
  const navigate = useNavigate()
  const isDev = import.meta.env.DEV || window.location.hostname === 'localhost'

  useEffect(() => {
    function handleResize() {
      setViewportWidth(window.innerWidth)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (!name.trim()) {
      setError('Full name is required')
      setLoading(false)
      return
    }

    if (!email.trim() || !email.includes('@')) {
      setError('Valid email is required')
      setLoading(false)
      return
    }

    try {
      const payload = await apiRequest('/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), name: name.trim() }),
      })

      const debugCode = payload.data?.debugCode

      if (debugCode && !isDev) {
        throw new Error('Email service is not configured on the server. Please try again later.')
      }

      setSuccess(
        debugCode && isDev
          ? `${payload.message || 'Verification code sent.'} Dev code: ${debugCode}`
          : payload.message || 'Check your inbox for the verification code.'
      )

      try {
        localStorage.setItem('es_pending_email', email.trim())
        localStorage.setItem('es_pending_name', name.trim())
      } catch {}

      setTimeout(() => {
        navigate('/verify', {
          state: { email: email.trim(), name: name.trim() },
          replace: true,
        })
      }, 800)
    } catch (err) {
      setError(getFriendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  // Layers the overrides sequentially as the screen gets narrower
  const styles = {
    ...baseStyles,
    ...(viewportWidth <= 900 ? tabletStyles : {}),
    ...(viewportWidth <= 720 ? mobileStyles : {}),
    ...(viewportWidth <= 655 ? narrowMobileStyles : {}),
    ...(viewportWidth <= 420 ? compactStyles : {}),
    ...(viewportWidth <= 360 ? tinyMobileStyles : {}),
  }

  return (
    <div style={styles.shell}>
      <div style={styles.glowA} aria-hidden="true" />
      <div style={styles.glowB} aria-hidden="true" />

      <header style={styles.topbar}>
        <button type="button" onClick={() => navigate('/')} style={styles.brand} aria-label="EventsNest home">
          <span style={styles.brandMark}>✦</span>
          <span>EventsNest</span>
        </button>

        <button type="button" onClick={() => navigate('/discover')} style={styles.topLink}>
          Browse events
        </button>
      </header>

      <section style={styles.hero}>
        <div style={styles.copyCol}>
          <p style={styles.kicker}>
            <span style={styles.kickerDot} />
            One polished link for your invite
          </p>
          <h1 style={styles.title}>
            Sign in to <span style={styles.titleAccent}>EventsNest</span>
          </h1>
          <p style={styles.sub}>
            Enter your name and email to receive a one-time code. The flow is kept calm,
            premium, and easy to finish on any device.
          </p>

          <div style={styles.featureRow}>
            {benefits.map((benefit) => (
              <article key={benefit.value} style={styles.featureCard}>
                <span style={styles.featureValue}>{benefit.value}</span>
                <span style={styles.featureLabel}>{benefit.label}</span>
              </article>
            ))}
          </div>
        </div>

        <div style={styles.formWrap}>
          <div style={styles.card}>
            <div style={styles.cardBadge}>Start here</div>
            <h2 style={styles.cardTitle}>Create your access code</h2>
            <p style={styles.cardSub}>A quick sign-in for hosts, guests, and event organizers.</p>

            <form onSubmit={handleSubmit} style={styles.form}>
              <input
                type="text"
                placeholder="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
                style={styles.input}
              />
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                style={styles.input}
              />

              {success && <p style={styles.success}>{success}</p>}
              {error && <p style={styles.error}>{error}</p>}

              <button type="submit" disabled={loading} style={styles.btn}>
                {loading ? 'Sending verification code…' : 'Continue →'}
              </button>
            </form>

            <p style={styles.footer}>
              By signing up, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

const baseStyles = {
  shell: {
    minHeight: '100vh',
    position: 'relative',
    overflow: 'hidden',
    background:
      'radial-gradient(circle at 14% 14%, rgba(232,200,122,0.14), transparent 28%), radial-gradient(circle at 82% 12%, rgba(167,139,250,0.11), transparent 24%), linear-gradient(180deg, #101010 0%, #090909 100%)',
    color: '#f5f0e8',
    fontFamily: 'Inter, "Segoe UI", Roboto, sans-serif',
    padding: '24px clamp(16px, 4vw, 40px) 40px',
  },
  glowA: {
    position: 'absolute',
    top: '-4%',
    left: '-8%',
    width: 520,
    height: 520,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(232,200,122,0.14), transparent 68%)',
    filter: 'blur(40px)',
    pointerEvents: 'none',
  },
  glowB: {
    position: 'absolute',
    top: '14%',
    right: '-10%',
    width: 620,
    height: 620,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(74,222,128,0.08), transparent 68%)',
    filter: 'blur(40px)',
    pointerEvents: 'none',
  },
  topbar: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    maxWidth: 1280,
    margin: '0 auto',
    padding: '16px 18px',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 20,
    background: 'rgba(10,10,10,0.72)',
    backdropFilter: 'blur(18px)',
    boxShadow: '0 18px 50px rgba(0,0,0,0.25)',
  },
  brand: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    background: 'transparent',
    color: '#f5f0e8',
    border: 'none',
    padding: 0,
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '-0.03em',
    cursor: 'pointer',
  },
  brandMark: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    borderRadius: 10,
    background: 'rgba(232,200,122,0.12)',
    color: '#e8c87a',
  },
  topLink: {
    background: 'rgba(232,200,122,0.10)',
    color: '#e8c87a',
    border: '1px solid rgba(232,200,122,0.20)',
    borderRadius: 999,
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  hero: {
    position: 'relative',
    zIndex: 1,
    maxWidth: 1280,
    margin: '0 auto',
    minHeight: 'calc(100vh - 120px)',
    display: 'grid',
    gridTemplateColumns: '1.1fr 0.9fr',
    gap: 28,
    alignItems: 'center',
    paddingTop: 24,
  },
  copyCol: {
    maxWidth: 620,
    padding: '24px 0',
  },
  kicker: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    margin: '0 0 18px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    color: 'rgba(245,240,232,0.55)',
  },
  kickerDot: {
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: '#e8c87a',
  },
  title: {
    margin: 0,
    fontSize: 'clamp(2.5rem, 6vw, 4.6rem)',
    lineHeight: 0.98,
    letterSpacing: '-0.06em',
    color: '#f5f0e8',
  },
  titleAccent: {
    color: '#e8c87a',
    fontStyle: 'italic',
  },
  sub: {
    margin: '18px 0 0',
    maxWidth: 560,
    fontSize: 16,
    lineHeight: 1.75,
    color: 'rgba(245,240,232,0.62)',
  },
  featureRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 12,
    marginTop: 28,
  },
  featureCard: {
    padding: '18px 16px',
    borderRadius: 18,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 18px 40px rgba(0,0,0,0.18)',
  },
  featureValue: {
    display: 'block',
    marginBottom: 6,
    fontSize: 24,
    fontWeight: 800,
    letterSpacing: '-0.04em',
    color: '#f5f0e8',
  },
  featureLabel: {
    display: 'block',
    fontSize: 12,
    color: 'rgba(245,240,232,0.52)',
  },
  formWrap: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  card: {
    width: '100%',
    maxWidth: 440,
    padding: 28,
    borderRadius: 28,
    background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 30px 90px rgba(0,0,0,0.4)',
    backdropFilter: 'blur(18px)',
  },
  cardBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 12px',
    borderRadius: 999,
    background: 'rgba(232,200,122,0.12)',
    color: '#e8c87a',
    border: '1px solid rgba(232,200,122,0.18)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
  },
  cardTitle: {
    margin: '18px 0 8px',
    fontSize: 28,
    lineHeight: 1.05,
    letterSpacing: '-0.04em',
    color: '#f5f0e8',
  },
  cardSub: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.7,
    color: 'rgba(245,240,232,0.56)',
  },
  form: {
    width: '100%',
    marginTop: 22,
  },
  input: {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: '14px 16px',
    fontSize: 15,
    color: '#e8e8ec',
    outline: 'none',
    marginBottom: 12,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, background 0.2s',
  },
  btn: {
    width: '100%',
    background: '#e8c87a',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: 999,
    padding: '14px 0',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity 0.2s, transform 0.15s',
    marginTop: 6,
  },
  error: {
    fontSize: 12.5,
    color: '#fca5a5',
    marginBottom: 12,
    textAlign: 'left',
    padding: '10px 12px',
    background: 'rgba(248, 113, 113, 0.1)',
    borderRadius: 10,
    border: '1px solid rgba(248, 113, 113, 0.18)',
  },
  success: {
    fontSize: 12.5,
    color: '#86efac',
    marginBottom: 12,
    textAlign: 'left',
    padding: '10px 12px',
    background: 'rgba(134, 239, 172, 0.1)',
    borderRadius: 10,
    border: '1px solid rgba(134, 239, 172, 0.18)',
  },
  footer: {
    marginTop: 18,
    fontSize: 11,
    color: 'rgba(245,240,232,0.46)',
    lineHeight: 1.6,
  },
}

const tabletStyles = {
  hero: {
    gridTemplateColumns: '1fr',
    gap: 18,
    minHeight: 'auto',
    paddingTop: 32,
    paddingBottom: 32,
  },
  formWrap: {
    justifyContent: 'stretch',
  },
  card: {
    maxWidth: '100%',
  },
}

const mobileStyles = {
  shell: {
    padding: '16px 12px 28px',
  },
  topbar: {
    padding: '14px 14px',
    borderRadius: 18,
  },
  featureRow: {
    gridTemplateColumns: '1fr',
  },
  card: {
    padding: 22,
    borderRadius: 24,
  },
  cardTitle: {
    fontSize: 24,
  },
  title: {
    fontSize: 'clamp(2.1rem, 12vw, 3.2rem)',
  },
}

// --- NEW RESPONSIVE BLOCKS START HERE ---

// Breakpoint for 655px downwards
const narrowMobileStyles = {
  shell: {
    padding: '12px 12px 24px',
  },
  title: {
    fontSize: '2.2rem', // Prevents clamp layout shifts
    lineHeight: '1.1',
    letterSpacing: '-0.04em',
  },
  sub: {
    fontSize: '14px',
    lineHeight: '1.6',
    marginTop: '12px',
  },
  featureRow: {
    // Splits features into a tight layout so it doesn't take too vertical space
    gridTemplateColumns: '1fr', 
    gap: '8px',
    marginTop: '20px',
  },
  featureCard: {
    padding: '12px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  featureValue: {
    marginBottom: 0,
    fontSize: '18px',
  },
}

// Overrides for 420px downwards (Your existing setup optimized)
const compactStyles = {
  topbar: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '10px',
    padding: '12px',
  },
  brand: {
    justifyContent: 'center',
  },
  topLink: {
    width: '100%',
    textAlign: 'center',
    padding: '8px 12px',
  },
  card: {
    padding: '18px',
    borderRadius: '20px',
  },
  cardTitle: {
    fontSize: '20px',
  },
}

// Critical breakpoint for 360px down to 320px
const tinyMobileStyles = {
  title: {
    fontSize: '1.8rem',
  },
  card: {
    padding: '14px',
    borderRadius: '16px',
  },
  input: {
    padding: '12px',
    fontSize: '14px',
  },
  btn: {
    padding: '12px 0',
    fontSize: '13px',
  },
}