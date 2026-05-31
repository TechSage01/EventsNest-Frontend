import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import BackButton from '../components/BackButton.jsx'
import { apiRequest } from '../services/api.js'

const verifyRequests = new Map()

function verifyReferenceOnce(reference) {
  if (!verifyRequests.has(reference)) {
    verifyRequests.set(
      reference,
      apiRequest('/payments/paystack/verify', {
        method: 'POST',
        body: JSON.stringify({ reference }),
      }).catch(error => {
        verifyRequests.delete(reference)
        throw error
      })
    )
  }

  return verifyRequests.get(reference)
}

function buildSuccessPath(type, details, reference) {
  if (type === 'vote') {
    const eventId = details?.eventId || ''
    const awardId = details?.awardId || ''
    const params = new URLSearchParams({
      type: 'vote',
      reference,
      title: 'Thank you for voting',
      subtitle: 'Your vote has been recorded successfully. You can vote for a friend next.',
      back: eventId ? `/public/events/${eventId}` : '/events',
    })

    if (eventId) params.set('eventId', eventId)
    if (awardId) params.set('awardId', awardId)

    return `/voting-success?${params.toString()}`
  }

  const ticketId = details?.ticket?.ticketId || ''
  const eventId = details?.ticket?.eventId || details?.event?.id || details?.event?._id || ''
  const params = new URLSearchParams({
    type: 'ticket',
    reference,
    title: 'Thank you for your payment',
    subtitle: 'Your ticket is confirmed. You can reserve another one for a friend next.',
    back: eventId ? `/public/events/${eventId}` : '/events',
  })

  if (ticketId) {
    params.set('ticketId', ticketId)
    params.set('ticketUrl', `/tickets/${ticketId}`)
  }

  return `/ticket-success?${params.toString()}`
}

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const routedRef = useRef(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [details, setDetails] = useState(null)

  const reference = searchParams.get('reference') || searchParams.get('trxref') || searchParams.get('trxRef') || ''

  useEffect(() => {
    let active = true
    async function verifyPayment() {
      if (!reference) {
        setError('Missing payment reference.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        const payload = await verifyReferenceOnce(reference)
        if (!active) return
        const resolvedDetails = payload.data || null
        const resolvedType = String(resolvedDetails?.type || '').toLowerCase()

        if (resolvedType !== 'vote' && resolvedType !== 'ticket') {
          throw new Error('Unable to determine payment type.')
        }

        setDetails(resolvedDetails)

        if (!routedRef.current) {
          routedRef.current = true
          navigate(buildSuccessPath(resolvedType, resolvedDetails, reference), { replace: true })
        }
      } catch (err) {
        if (!active) return
        setError(err.message || 'Unable to verify payment')
      } finally {
        if (!active) return
        setLoading(false)
      }
    }

    verifyPayment()
    return () => {
      active = false
    }
  }, [navigate, reference])

  const resolvedType = String(details?.type || '').toLowerCase()
  const isVote = resolvedType === 'vote'
  const eventId = details?.eventId || searchParams.get('eventId') || ''
  const ticketId = details?.ticket?.ticketId || searchParams.get('ticketId') || ''

  const primaryAction = useMemo(() => {
    if (isVote && eventId) {
      return { label: 'Back to Event', path: `/public/events/${eventId}` }
    }
    if (!isVote && ticketId) {
      return { label: 'View Ticket', path: `/tickets/${ticketId}` }
    }
    return { label: 'Back to Home', path: '/' }
  }, [eventId, isVote, ticketId])

  const voteSummary = {
    nomineeName: details?.contestant?.name || 'Nominee',
    quantity: Number(details?.quantity || 0),
    paymentReference: details?.paymentReference || reference,
  }

  const ticketSummary = {
    eventTitle: details?.event?.title || 'Your event',
    ticketId: details?.ticket?.ticketId || ticketId,
    paymentReference: details?.paymentReference || reference,
  }

  return (
    <div style={styles.page}>
      <main style={styles.card}>
        <div style={styles.backRow}>
          <BackButton fallback="/" />
        </div>
        <div style={styles.iconWrap} aria-hidden="true">
          <span style={styles.icon}>✓</span>
        </div>

        {loading && (
          <>
            <h1 style={styles.title}>Verifying Payment</h1>
            <p style={styles.subtitle}>Confirming your transaction with Paystack...</p>
          </>
        )}

        {!loading && error && (
          <>
            <h1 style={styles.title}>Payment Pending</h1>
            <p style={styles.subtitle}>{error}</p>
          </>
        )}

        {!loading && !error && isVote && (
          <>
            <h1 style={styles.title}>Vote Successful</h1>
            <p style={styles.subtitle}>Your votes have been securely updated on the platform.</p>
            <div style={styles.detailGrid}>
              <div style={styles.detailRow}><span>Nominee</span><strong>{voteSummary.nomineeName}</strong></div>
              <div style={styles.detailRow}><span>Votes purchased</span><strong>{voteSummary.quantity}</strong></div>
              <div style={styles.detailRow}><span>Payment reference</span><strong>{voteSummary.paymentReference}</strong></div>
            </div>
          </>
        )}

        {!loading && !error && !isVote && (
          <>
            <h1 style={styles.title}>Payment Successful</h1>
            <p style={styles.subtitle}>Your ticket has been confirmed. Check your email for your QR code.</p>
            <div style={styles.detailGrid}>
              <div style={styles.detailRow}><span>Event</span><strong>{ticketSummary.eventTitle}</strong></div>
              <div style={styles.detailRow}><span>Ticket ID</span><strong>{ticketSummary.ticketId}</strong></div>
              <div style={styles.detailRow}><span>Payment reference</span><strong>{ticketSummary.paymentReference}</strong></div>
            </div>
          </>
        )}

        <button type="button" style={styles.primaryBtn} onClick={() => navigate(primaryAction.path)}>
          {primaryAction.label}
        </button>
      </main>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: 24,
    background: 'radial-gradient(circle at top, rgba(34,197,94,0.16), transparent 35%), linear-gradient(180deg, #0f1015 0%, #0b0c10 100%)',
    color: '#f8fafc',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  card: {
    width: 'min(100%, 560px)',
    padding: '36px 28px',
    borderRadius: 28,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
    textAlign: 'center',
  },
  backRow: { display: 'flex', justifyContent: 'flex-start', marginBottom: 18 },
  iconWrap: {
    width: 70,
    height: 70,
    borderRadius: '50%',
    display: 'grid',
    placeItems: 'center',
    margin: '0 auto 18px',
    background: 'rgba(34,197,94,0.16)',
    border: '1px solid rgba(34,197,94,0.35)',
  },
  icon: { fontSize: 34, fontWeight: 900, color: '#4ade80' },
  title: { margin: 0, fontSize: 'clamp(26px, 4vw, 40px)' },
  subtitle: { margin: '12px 0 24px', color: '#cbd5f5', lineHeight: 1.6, fontSize: 15 },
  detailGrid: {
    display: 'grid',
    gap: 10,
    marginTop: 12,
    marginBottom: 24,
    textAlign: 'left',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    padding: '10px 12px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    fontSize: 14,
  },
  primaryBtn: {
    border: 'none',
    borderRadius: 14,
    padding: '12px 20px',
    background: '#22c55e',
    color: '#0b0c0f',
    fontWeight: 800,
    cursor: 'pointer',
    minWidth: 200,
  },
}
