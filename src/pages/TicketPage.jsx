import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import BackButton from '../components/BackButton.jsx'
import { getApiBaseUrl } from '../services/api.js'

export default function TicketPage() {
  const { ticketId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const API_BASE = getApiBaseUrl()
  const [ticket, setTicket] = useState(null)
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [downloadingQr, setDownloadingQr] = useState(false)
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1024))

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    async function loadTicket() {
      setLoading(true)
      setError('')

      try {
        const res = await fetch(`${API_BASE}/tickets/${ticketId}`)
        const payload = await res.json()
        if (!res.ok) throw new Error(payload.message || 'Failed to load ticket')

        setTicket(payload.data?.ticket)
        setEvent(payload.data?.event)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadTicket()
  }, [ticketId])

  useEffect(() => {
    const reference = searchParams.get('reference')
    if (!ticket || !reference || ticket.status === 'confirmed') return

    async function verifyPayment() {
      setVerifying(true)

      try {
        const res = await fetch(`${API_BASE}/tickets/paystack/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticketId, reference }),
        })
        const payload = await res.json()

        if (!res.ok) throw new Error(payload.message || 'Payment verification failed')

        setTicket(payload.data?.ticket)
        setEvent(payload.data?.event)
        const ticketPageUrl = `/tickets/${payload.data?.ticket?.ticketId}`
        navigate(
          `/ticket-success?back=${encodeURIComponent(`/public/events/${payload.data?.ticket?.eventId}`)}&ticketUrl=${encodeURIComponent(ticketPageUrl)}&title=${encodeURIComponent('Thank you for your payment')}&subtitle=${encodeURIComponent('Your ticket is confirmed. You can reserve another one for a friend next.')}`,
          { replace: true }
        )
      } catch (err) {
        setError(err.message)
      } finally {
        setVerifying(false)
      }
    }

    verifyPayment()
  }, [navigate, ticket, ticketId, searchParams])

  async function handleDownloadQr() {
    if (downloadingQr) return

    setDownloadingQr(true)
    try {
      const res = await fetch(`${API_BASE}/tickets/${ticket.ticketId}/qr`)
      if (!res.ok) throw new Error('Failed to download QR code')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `ticket-${ticket.ticketId}-qr.png`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setDownloadingQr(false)
    }
  }

  if (loading) return <Shell message="Loading ticket..." />
  if (error && !ticket) return <Shell message={error} actionLabel="Back to Events" onAction={() => navigate('/events')} />
  if (!ticket) return <Shell message="Ticket not found" actionLabel="Back to Events" onAction={() => navigate('/events')} />

  const ticketUrl = `${window.location.origin}/tickets/${ticket.ticketId}`
  const qrPayload = ticket.qrCodeText || ticketUrl
  const isCompact = viewportWidth < 860
  const isNarrow = viewportWidth < 560
  const qrSize = viewportWidth < 420 ? 180 : viewportWidth < 560 ? 200 : 220
  const showQrActions = ticket.status === 'confirmed' || searchParams.get('success') === '1'

  return (
    <div style={styles.page}>
      <main style={styles.main}>
        <BackButton fallback="/" style={styles.backButton} />
        <section style={styles.card}>
          {searchParams.get('duplicate') === '1' && (
            <div style={styles.notice}>
              This email already has a ticket, so we opened the existing one instead of creating another.
            </div>
          )}
          <div style={styles.kicker}>Your Ticket</div>
          <h1 style={styles.title}>{event?.title || 'Event Ticket'}</h1>
          <p style={styles.subTitle}>{event?.startDate} · {event?.startTime}{event?.location ? ` · ${event.location}` : ''}</p>

          <div style={isCompact ? styles.bodyGridStacked : styles.bodyGrid}>
            <div style={styles.qrPanel}>
              <div style={styles.qrFrame}>
                <QRCodeSVG value={qrPayload} size={qrSize} bgColor="#ffffff" fgColor="#0b0b10" includeMargin />
              </div>
              <div style={styles.ticketId}>{ticket.ticketId}</div>
              {showQrActions && (
                <button type="button" style={{ ...styles.secondaryBtn, width: '100%' }} onClick={handleDownloadQr} disabled={downloadingQr}>
                  {downloadingQr ? 'Downloading…' : 'Download QR Code'}
                </button>
              )}
            </div>

            <div style={styles.metaPanel}>
              {searchParams.get('success') === '1' && <div style={styles.success}>Your QR code has been successfully sent to your Gmail.</div>}
              {verifying && <div style={styles.success}>Verifying payment with Paystack...</div>}
              {ticket.status === 'confirmed' && <div style={styles.success}>Payment confirmed. Your QR ticket is ready.</div>}
              <div style={styles.metaRow}><span>Name</span><strong>{ticket.attendeeName}</strong></div>
              <div style={styles.metaRow}><span>Email</span><strong>{ticket.attendeeEmail}</strong></div>
              <div style={styles.metaRow}><span>Type</span><strong>{ticket.ticketType}</strong></div>
              <div style={styles.metaRow}><span>Status</span><strong>{ticket.status}</strong></div>
              <div style={styles.metaRow}><span>Amount Paid</span><strong>{ticket.amountPaid ? `₦${Number(ticket.amountPaid).toLocaleString()}` : (ticket.price ? `₦${Number(ticket.price).toLocaleString()}` : 'Free')}</strong></div>
              <button type="button" style={{ ...styles.primaryBtn, width: isNarrow ? '100%' : 'auto' }} onClick={() => navigate(`/public/events/${ticket.eventId}`)}>
                Back to Event
              </button>
              {searchParams.get('success') === '1' && <div style={styles.success}>Ticket confirmed. Check your email for a copy.</div>}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function Shell({ message, actionLabel, onAction }) {
  return (
    <div style={styles.shell}>
      <div style={styles.shellCard}>
        <BackButton fallback="/" style={styles.shellBackButton} />
        <div style={styles.shellTitle}>{message}</div>
        {onAction && (
          <button type="button" style={styles.primaryBtn} onClick={onAction}>
            {actionLabel || 'Continue'}
          </button>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', background: 'radial-gradient(circle at top, rgba(167,139,250,0.12), transparent 28%), linear-gradient(180deg, #101014 0%, #0b0b10 100%)', color: '#f1f1f5', fontFamily: "'DM Sans', system-ui, sans-serif" },
  shell: { minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#101014', color: '#f1f1f5', fontFamily: "'DM Sans', system-ui, sans-serif", padding: '24px' },
  shellCard: { width: 'min(100%, 420px)', padding: '24px 20px', borderRadius: 18, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' },
  shellBackButton: { marginBottom: 14 },
  shellTitle: { fontSize: 18, marginBottom: 12 },
  main: { width: '100%', maxWidth: 1100, margin: '0 auto', padding: 'clamp(18px, 4vw, 48px) clamp(14px, 3vw, 28px)' },
  backButton: { marginBottom: 16 },
  card: { padding: 'clamp(18px, 3vw, 28px)', borderRadius: 28, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 24px 70px rgba(0,0,0,0.28)' },
  kicker: { color: '#a9a9b6', fontWeight: 700, marginBottom: 8 },
  title: { fontSize: 'clamp(30px, 6vw, 60px)', lineHeight: 1.02, margin: 0, fontWeight: 900, letterSpacing: '-0.05em', overflowWrap: 'anywhere' },
  subTitle: { color: '#cfd0da', marginTop: 12, marginBottom: 24, fontSize: 'clamp(14px, 2vw, 16px)', lineHeight: 1.5 },
  bodyGrid: { display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) minmax(0, 1fr)', gap: 20, alignItems: 'start' },
  bodyGridStacked: { display: 'grid', gridTemplateColumns: '1fr', gap: 20, alignItems: 'start' },
  qrPanel: { display: 'grid', placeItems: 'center', padding: '18px 16px', borderRadius: 22, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' },
  qrFrame: { display: 'grid', placeItems: 'center', padding: 12, borderRadius: 18, background: '#fff', maxWidth: '100%' },
  ticketId: { marginTop: 14, fontFamily: 'monospace', fontSize: 12, color: '#a9a9b6', wordBreak: 'break-all', textAlign: 'center', lineHeight: 1.5 },
  metaPanel: { padding: '4px 2px 0' },
  metaRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#d4d4de', flexWrap: 'wrap' },
  secondaryBtn: { marginTop: 16, border: '1px solid rgba(167,139,250,0.25)', borderRadius: 14, padding: '12px 16px', background: 'rgba(167,139,250,0.12)', color: '#e9d5ff', fontWeight: 800, cursor: 'pointer', transition: 'transform 0.2s ease, opacity 0.2s ease' },
  primaryBtn: { marginTop: 16, border: 'none', borderRadius: 14, padding: '12px 16px', background: '#f1f1f5', color: '#111', fontWeight: 800, cursor: 'pointer', transition: 'transform 0.2s ease, opacity 0.2s ease' },
  success: { marginTop: 12, padding: '12px 14px', borderRadius: 14, background: 'rgba(34,197,94,0.12)', color: '#86efac', fontWeight: 700, lineHeight: 1.5 },
  notice: { marginBottom: 14, padding: '12px 14px', borderRadius: 14, background: 'rgba(59,130,246,0.12)', color: '#93c5fd', fontWeight: 700, lineHeight: 1.5 },
}
