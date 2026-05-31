import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { apiRequest, getFriendlyErrorMessage } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`
}

const stats = [
  { value: '60s', label: 'Fast verification' },
  { value: '6', label: 'Digits only' },
  { value: '∞', label: 'Resend if needed' },
]

export default function VerifyPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setSession } = useAuth()

  const email = location.state?.email || ''
  const name = location.state?.name || ''

  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [countdown, setCountdown] = useState(600)
  const [canResend, setCanResend] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 1024 : window.innerWidth))
  const isDev = import.meta.env.DEV || window.location.hostname === 'localhost'

  const inputRefs = useRef([])

  useEffect(() => {
    if (!email) navigate('/signup', { replace: true })
  }, [email, navigate])

  useEffect(() => {
    function handleResize() {
      setViewportWidth(window.innerWidth)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true)
      return
    }

    const timerId = window.setInterval(() => {
      setCountdown((seconds) => seconds - 1)
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [countdown])

  useEffect(() => {
    if (inputRefs.current[0]) inputRefs.current[0].focus()
  }, [])

  function handleOtpChange(index, value) {
    if (!/^\d*$/.test(value)) return

    const digits = otp.split('')
    digits[index] = value
    setOtp(digits.join('').slice(0, 6))

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  function handleOtpKeyDown(index, event) {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  function handleOtpPaste(event) {
    event.preventDefault()
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    setOtp(pasted)
    if (pasted.length === 6) {
      inputRefs.current[5]?.focus()
    }
  }

  async function handleVerify(event) {
    event.preventDefault()

    if (otp.length !== 6) {
      setError('Please enter a 6-digit code')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const payload = await apiRequest('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, code: otp }),
      })

      const user = payload.data?.user
      const token = payload.data?.token
      if (!user || !token) throw new Error(payload.message || 'Verification failed')

      setSuccess('Email verified — redirecting…')
      setSession(user, token)
      setTimeout(() => navigate('/events', { replace: true }), 700)
    } catch (err) {
      setError(getFriendlyErrorMessage(err))
      setOtp('')
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (!email || resendLoading || !canResend) return

    setResendLoading(true)
    setError('')
    setSuccess('')

    try {
      const payload = await apiRequest('/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ email, name }),
      })

      const debugCode = payload.data?.debugCode
      if (debugCode && !isDev) {
        throw new Error('Email service is not configured on the server. Please try again later.')
      }

      setSuccess(debugCode && isDev ? `New code sent (dev): ${debugCode}` : 'New code sent — check your inbox')
      setCountdown(600)
      setCanResend(false)
      setOtp('')
      inputRefs.current[0]?.focus()
    } catch (err) {
      setError(getFriendlyErrorMessage(err))
    } finally {
      setResendLoading(false)
    }
  }

  const styles = {
    ...baseStyles,
    ...(viewportWidth <= 900 ? tabletStyles : {}),
    ...(viewportWidth <= 720 ? mobileStyles : {}),
    ...(viewportWidth <= 420 ? compactStyles : {}),
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
            Almost there
          </p>
          <h1 style={styles.title}>
            Check your <span style={styles.titleAccent}>email</span>
          </h1>
          <p style={styles.sub}>
            We sent a 6-digit code to {email ? <strong style={styles.strong}>{email}</strong> : 'your email address'}.
            Enter it below to finish signing in.
          </p>

          <div style={styles.featureRow}>
            {stats.map((item) => (
              <article key={item.label} style={styles.featureCard}>
                <span style={styles.featureValue}>{item.value}</span>
                <span style={styles.featureLabel}>{item.label}</span>
              </article>
            ))}
          </div>
        </div>

        <div style={styles.formWrap}>
          <div style={styles.card}>
            <div style={styles.cardBadge}>Verify code</div>
            <h2 style={styles.cardTitle}>Enter the 6-digit OTP</h2>
            <p style={styles.cardSub}>Use the code from your inbox to continue into EventsNest.</p>

            <form onSubmit={handleVerify} style={styles.form}>
              <div style={styles.otpContainer}>
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    maxLength={1}
                    value={otp[index] || ''}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={handleOtpPaste}
                    disabled={loading}
                    style={styles.otpInput}
                  />
                ))}
              </div>

              {success && <p style={styles.success}>{success}</p>}
              {error && <p style={styles.error}>{error}</p>}

              <button type="submit" disabled={loading || otp.length !== 6} style={styles.btn}>
                {loading ? 'Verifying…' : 'Verify code →'}
              </button>
            </form>

            <div style={styles.timerSection}>
              <p style={styles.timerText}>
                Code expires in <strong>{formatTime(countdown)}</strong>
              </p>
              <button
                type="button"
                onClick={handleResend}
                disabled={!canResend || resendLoading}
                style={{ ...styles.resendBtn, opacity: canResend ? 1 : 0.5 }}
              >
                {resendLoading ? 'Sending…' : "Didn't get a code? Resend"}
              </button>
            </div>

            <button type="button" onClick={() => navigate('/signup', { replace: true })} style={styles.backBtn}>
              ← Change email
            </button>
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
    padding: 0,
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '-0.03em',
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
  strong: {
    color: '#f5f0e8',
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
  otpContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
    gap: 8,
    marginBottom: 12,
  },
  otpInput: {
    width: '100%',
    aspectRatio: '1 / 1',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    fontSize: 22,
    fontWeight: 700,
    color: '#e8e8ec',
    textAlign: 'center',
    outline: 'none',
    padding: 0,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
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
  timerSection: {
    width: '100%',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    paddingTop: 14,
    marginTop: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  timerText: {
    fontSize: 13,
    color: 'rgba(245,240,232,0.56)',
    margin: 0,
  },
  resendBtn: {
    background: 'none',
    border: 'none',
    color: '#e8c87a',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textDecoration: 'underline',
    padding: 0,
    textAlign: 'left',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(245,240,232,0.46)',
    fontSize: 13,
    marginTop: 18,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textDecoration: 'underline',
    padding: 0,
    textAlign: 'left',
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

const compactStyles = {
  topbar: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  brand: {
    justifyContent: 'center',
  },
  topLink: {
    width: '100%',
    textAlign: 'center',
  },
  card: {
    padding: 18,
    borderRadius: 20,
  },
  otpContainer: {
    gap: 6,
  },
  otpInput: {
    borderRadius: 12,
    fontSize: 18,
  },
}