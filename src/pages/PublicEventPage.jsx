import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BackButton from '../components/BackButton.jsx'
import { getApiBaseUrl } from '../services/api.js'
import { getPaystackKey } from '../config/paystack.js'
import { PAYSTACK_CALLBACK_URL } from '../services/paystack.js'

const themeMap = {
  minimal: { bg: ['#10262b', '#081722'], accent: '#5eead4' },
  aurora: { bg: ['#1a0533', '#0d1f3c'], accent: '#a78bfa' },
  sunrise: { bg: ['#2d1a0e', '#1f0d1a'], accent: '#fb923c' },
  ocean: { bg: ['#0a1628', '#061a2e'], accent: '#38bdf8' },
  forest: { bg: ['#0d2110', '#0a1a0d'], accent: '#4ade80' },
  rose: { bg: ['#2d0a1a', '#1a0a1a'], accent: '#fb7185' },
  black: { bg: ['#000000', '#060606'], accent: '#ffffff' },
}

const ticketOptions = [
  { id: 'regular', label: 'Regular', desc: 'Standard entry for the event.' },
  { id: 'vip', label: 'VIP', desc: 'Priority entry and premium seating.' },
  { id: 'table', label: 'Table Reservation', desc: 'Reserve a table for your group.' },
]

export default function PublicEventPage() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const API_BASE = getApiBaseUrl()
  const paystackKey = getPaystackKey()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectedTicketType, setSelectedTicketType] = useState('regular')
  const [form, setForm] = useState({ name: '', email: '', note: '' })
  const [donation, setDonation] = useState(0)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!form.email) return

    const derivedName = deriveNameFromEmail(form.email)
    setForm(prev => {
      if (prev.name && prev.name !== deriveNameFromEmail(prev.email)) return prev
      return { ...prev, name: derivedName }
    })
  }, [form.email])

  useEffect(() => {
    async function loadEvent() {
      setLoading(true)
      setError('')

      try {
        const eventRes = await fetch(`${API_BASE}/events/public/${eventId}`)
        const payload = await eventRes.json()
        if (!eventRes.ok) throw new Error(payload.message || 'Failed to load event')
        setEvent(payload.data?.event)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadEvent()
  }, [eventId])

  const ticketBaseAmount = parseTicketAmount(event?.ticketPrice)
  const vipBaseAmount = (event?.ticketPrices && typeof event.ticketPrices.vip === 'number')
    ? Math.round(event.ticketPrices.vip)
    : 0
  const tableBaseAmount = (event?.ticketPrices && typeof event.ticketPrices.table === 'number')
    ? Math.round(event.ticketPrices.table)
    : 0
  const ticketFeeAmount = calculateTicketFee(ticketBaseAmount)
  const ticketTotalAmount = ticketBaseAmount + ticketFeeAmount
  const vipFeeAmount = calculateTicketFee(vipBaseAmount)
  const vipTotalAmount = vipBaseAmount + vipFeeAmount
  const tableFeeAmount = calculateTicketFee(tableBaseAmount)
  const tableTotalAmount = tableBaseAmount + tableFeeAmount

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setSuccess('')
    setError('')

    const baseAmount = selectedTicketType === 'vip'
      ? vipBaseAmount
      : selectedTicketType === 'table'
        ? tableBaseAmount
        : ticketBaseAmount
    const feeAmount = selectedTicketType === 'vip'
      ? vipFeeAmount
      : selectedTicketType === 'table'
        ? tableFeeAmount
        : ticketFeeAmount
    const donationValue = Number(donation || 0)
    const totalDue = baseAmount + feeAmount + donationValue
    const amountInKobo = Math.round(totalDue * 100)
    const ticketQuantity = 1
    const ticketPayload = {
      email: form.email,
      amount: amountInKobo,
      publicKey: paystackKey,
      callback_url: PAYSTACK_CALLBACK_URL,
      metadata: {
        type: 'ticket',
        eventId: eventId,
        quantity: ticketQuantity,
      },
    }

    if (totalDue > 0 && !paystackKey) {
      console.error('Paystack public key missing. Check environment configuration.')
      setError('Paystack is not configured properly')
      setSubmitting(false)
      return
    }

    try {
      const res = await fetch(`${API_BASE}/tickets/events/${eventId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          ticketType: selectedTicketType,
          donation: Number(donation || 0),
          paystackConfig: ticketPayload,
          metadata: ticketPayload.metadata,
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.message || 'Failed to reserve ticket')

      if (payload.data?.authorization_url) {
        window.location.href = payload.data.authorization_url
        return
      }

      if (!payload.data?.paymentRequired) {
        const ticketId = payload.data?.ticket?.ticketId
        const isDuplicate = String(payload.message || '').toLowerCase().includes('already exists')
        setSuccess(isDuplicate ? 'This email already has a ticket. Opening it now.' : 'Your ticket has been created.')
        navigate(`/tickets/${ticketId}?success=1${isDuplicate ? '&duplicate=1' : ''}`)
        return
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Shell message="Loading event..." />
  if (error && !event) return <Shell message={error} actionLabel="Back to Events" onAction={() => navigate('/events')} />
  if (!event) return <Shell message="Event not found" actionLabel="Back to Events" onAction={() => navigate('/events')} />

  const theme = themeMap[event.theme] || themeMap.minimal

  return (
    <div style={{ ...styles.page, background: `linear-gradient(180deg, ${theme.bg[0]} 0%, #0d0e12 60%, #07080a 100%)` }}>
      <header style={styles.topbar}>
        <div style={styles.brandRow}>
          <span style={{ ...styles.logo, color: theme.accent }}>✦</span>
          <span style={styles.brand}>EventsNest</span>
        </div>
        <BackButton fallback="/" />
      </header>

      {notice && (
        <div style={styles.topNotice} role="status" aria-live="polite">{notice}</div>
      )}

      <main style={styles.main}>
        {/* HERO SECTION */}
        <section style={styles.hero}>
          <div style={styles.heroMedia}>
            {event.coverImage ? (
              <img src={event.coverImage} alt={event.title} style={styles.coverImage} />
            ) : (
              <div style={{ ...styles.coverFallback, background: `linear-gradient(135deg, ${theme.accent}20, rgba(255,255,255,0.01))` }} />
            )}
          </div>
          <div style={styles.heroContent}>
            <div style={{ ...styles.eventKicker, color: theme.accent, border: `1px solid ${theme.accent}33` }}>
              {event.isPublic ? 'Public Event' : 'Private Event'}
            </div>
            <h1 style={styles.title}>{event.title}</h1>
            <p style={styles.description}>{event.description || 'No description provided yet.'}</p>
            
            <div style={styles.metaRow}>
              <span style={styles.metaChip}>🕒 {formatDateLong(event.startDate)}</span>
              <span style={styles.metaChip}>⏰ {formatTimeRange(event.startTime, event.endTime)} GMT+1</span>
              <span style={styles.metaChip}>📍 {event.location || 'Location to be announced'}</span>
            </div>

            <div style={styles.hostRow}>
              <div style={{ ...styles.hostAvatar, background: `${theme.accent}22`, color: theme.accent, border: `1px solid ${theme.accent}44` }}>
                {initials(event.hostName || 'Creator')}
              </div>
              <div>
                <div style={styles.hostName}>{event.hostName || 'Creator'}</div>
                <div style={styles.hostEmail}>{event.hostEmail || ''}</div>
              </div>
            </div>
          </div>
        </section>

        {/* QUICK STATS */}
        <section style={styles.statsRow}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Ticket Type</div>
            <div style={{ ...styles.statValue, color: theme.accent }}>{selectedTicketType.toUpperCase()}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Price</div>
            <div style={styles.statValue}>{isFreePrice(event.ticketPrice) ? 'Free' : `₦${Number(event.ticketPrice || 0).toLocaleString()}`}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>RSVPs</div>
            <div style={styles.statValue}>{event.rsvpCount || 0}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Total Sent</div>
            <div style={styles.statValue}>{event.invitationsSent || 0}</div>
          </div>
        </section>

        {/* WORKFLOW PANELS */}
        <div style={styles.contentGrid}>
          <div style={styles.leftStack}>
            
            {/* PANEL 1: TICKET SELECTION */}
            <div style={styles.panel}>
              <div style={styles.panelHead}>1. Select Ticket Type</div>
              {notice && <div style={styles.noticeBanner}>{notice}</div>}
              <div style={styles.ticketIntro}>Choose your preferred access tier for this event.</div>
              <div style={styles.ticketGrid}>
                {ticketOptions.map(option => {
                  const isActive = selectedTicketType === option.id;
                  const available = (option.id === 'vip')
                    ? (event?.ticketPrices && typeof event.ticketPrices.vip === 'number' && event.ticketPrices.vip > 0)
                    : (option.id === 'table')
                      ? (event?.ticketPrices && typeof event.ticketPrices.table === 'number' && event.ticketPrices.table > 0)
                      : true

                  return (
                    <button
                      key={option.id}
                      type="button"
                      style={{ 
                        ...styles.ticketCard, 
                        ...(isActive ? { borderColor: theme.accent, background: `${theme.accent}0a` } : {}),
                        ...(available ? {} : { opacity: 0.45, cursor: 'not-allowed' }),
                      }}
                      onClick={() => {
                        if (!available) {
                          setNotice(`${option.label} is not available for this event.`)
                          setTimeout(()=>setNotice(''),4000)
                          return
                        }
                        setSelectedTicketType(option.id)
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={styles.ticketCardTitle}>{option.label}</div>
                        <div style={{ 
                          ...styles.radioCircle, 
                          ...(isActive ? { borderColor: theme.accent, background: theme.accent } : {}) 
                        }} />
                      </div>
                      <div style={styles.ticketCardDesc}>{option.desc}</div>
                    </button>
                  );
                })}
              </div>

              <div style={styles.breakdownCard}>
                <div style={styles.breakdownHead}>Payment Summary</div>
                {(() => {
                  const base = selectedTicketType === 'vip'
                    ? vipBaseAmount
                    : selectedTicketType === 'table'
                      ? tableBaseAmount
                      : ticketBaseAmount
                  const fee = selectedTicketType === 'vip'
                    ? vipFeeAmount
                    : selectedTicketType === 'table'
                      ? tableFeeAmount
                      : ticketFeeAmount
                  const donationVal = Number(donation || 0)
                  const total = base + fee + donationVal
                  return (
                    <>
                      <div style={styles.breakdownRow}><span>Ticket tier</span><span style={{ color: '#fff' }}>{ticketOptions.find(o => o.id === selectedTicketType)?.label}</span></div>
                      <div style={styles.breakdownRow}><span>Base fee</span><span style={{ color: '#fff' }}>{formatCurrency(base)}</span></div>
                      <div style={styles.breakdownRow}><span>Processing fee</span><span style={{ color: '#fff' }}>{formatCurrency(fee)}</span></div>
                      <div style={styles.breakdownRow}><span>Donation (optional)</span><span style={{ color: '#fff' }}>{formatCurrency(donationVal)}</span></div>
                      <div style={styles.breakdownTotal}><span>Total Due</span><span style={{ color: theme.accent }}>{formatCurrency(total)}</span></div>
                    </>
                  )
                })()}
              </div>
            </div>

            {/* PANEL 2: RESERVATION FORM */}
            <div style={styles.panel}>
              <div style={styles.panelHead}>2. Attendee Registration</div>
                {success && <div style={styles.successBanner}>✓ {success}</div>}
                {notice && <div style={styles.noticeBanner}>{notice}</div>}
              
              <form onSubmit={handleSubmit} style={styles.form}>
                <div style={styles.field}>
                  <label style={styles.label}>Email Address</label>
                  <input type="email" value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} style={styles.input} placeholder="your@email.com" required />
                </div>
                
                <div style={styles.field}>
                  <label style={styles.label}>Full Name</label>
                  <input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} style={styles.input} placeholder="Will auto-fill or type here" />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Add a donation (optional)</label>
                  <input type="number" min="0" step="0.01" value={donation}
                    onChange={e => setDonation(e.target.value)} style={styles.input} placeholder="0.00" />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Note for the Host</label>
                  <textarea value={form.note} onChange={e => setForm(prev => ({ ...prev, note: e.target.value }))} rows={3} style={styles.textarea} placeholder="Any special requests or details optional..." />
                </div>

                <button type="submit" style={{ ...styles.submitBtn, background: theme.accent }} disabled={submitting}>
                  {submitting ? 'Processing Reservation...' : isFreePrice(event.ticketPrice) ? 'Claim Free Ticket' : `Secure Pass • ${formatCurrency((selectedTicketType==='vip'?vipTotalAmount:(selectedTicketType==='table'?tableTotalAmount:ticketTotalAmount)) + Number(donation||0))}`}
                </button>

                <button type="button" style={styles.secondaryBtn} onClick={() => navigate(`/public/events/${eventId}/voting`)}>
                  Go to Event Polls & Voting
                </button>
              </form>
            </div>

            {/* PANEL 3: VENUE & EXTRA INFORMATION */}
            <div style={styles.panel}>
              <div style={styles.panelHead}>Event Manifest & Venue</div>
              
              {/* Added Venue Image Block */}
              <div style={styles.venueImageContainer}>
                {event.venueImage ? (
                  <img src={event.venueImage} alt="Event Venue Layout" style={styles.venueImage} />
                ) : (
                  <div style={{ ...styles.venuePlaceholder, border: `1px dashed ${theme.accent}44` }}>
                    <span style={{ fontSize: 24, marginBottom: 4 }}>📍</span>
                    <span style={{ fontSize: 13, color: '#a1a1aa', fontWeight: 600 }}>{event.location || 'Location Pending Announcement'}</span>
                    <span style={{ fontSize: 11, color: '#52525b', marginTop: 2 }}>No setup preview image uploaded by host</span>
                  </div>
                )}
              </div>

              <div style={styles.detailRow}><span>Listing Visibility</span><strong>{event.isPublic ? 'Public Event' : 'Private Guestlist'}</strong></div>
              <div style={styles.detailRow}><span>Organized By</span><strong>{event.hostName || 'Creator'}</strong></div>
              <div style={styles.detailRow}><span>Contact Desk</span><strong>{event.hostEmail || '-'}</strong></div>
              <div style={styles.detailRow}><span>Total Capacity Seats Sent</span><strong>{event.invitationsSent || 0} RSVPs</strong></div>
              <p style={styles.footerNote}>
                Need to amplify your reach? Submit this event structure to the EventsNest Discover Board to get indexed in regional feeds.
              </p>
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}

function Shell({ message, actionLabel, onAction }) {
  return (
    <div style={styles.shellOnly}>
      <div style={styles.shellCard}>
        <BackButton fallback="/" style={styles.shellBackButton} />
        <div style={styles.shellTitle}>{message}</div>
        {onAction && (
          <button type="button" style={styles.backBtn} onClick={onAction}>
            {actionLabel || 'Continue'}
          </button>
        )}
      </div>
    </div>
  )
}

/* --- FORMATTING UTILITIES --- */
function formatDateLong(dateString) {
  if (!dateString) return 'Date not set'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return dateString
  return new Intl.DateTimeFormat('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function formatTimeRange(startTime, endTime) {
  if (!startTime && !endTime) return 'Time not set'
  return [startTime, endTime].filter(Boolean).join(' - ')
}

function formatCurrency(amount) {
  return `₦${Number(amount || 0).toLocaleString()}`
}

function parseTicketAmount(priceValue) {
  const normalized = String(priceValue ?? '').trim().toLowerCase()
  if (!normalized || normalized === 'free') return 0
  const numeric = Number(normalized.replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(numeric) || numeric <= 0) return 0
  return Math.round(numeric)
}

function calculateTicketFee(baseAmount) {
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) return 0
  return Math.max(100, Math.round(baseAmount * 0.02))
}

function initials(name) {
  return String(name || '').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || 'E'
}

function deriveNameFromEmail(email) {
  const localPart = String(email || '').split('@')[0] || ''
  const cleaned = localPart.replace(/[._+-]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  return cleaned.split(' ').filter(Boolean).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}

function isFreePrice(priceValue) {
  const normalized = String(priceValue ?? '').trim().toLowerCase()
  if (!normalized || normalized === 'free') return true
  const numeric = Number(normalized.replace(/[^0-9.]/g, ''))
  return Number.isFinite(numeric) && numeric <= 0
}

/* --- REDESIGNED NEU-DARK STYLESHEET WITH VENUE FIXES --- */
const styles = {
  page: { minHeight: '100vh', color: '#e4e4e7', fontFamily: "system-ui, -apple-system, sans-serif", paddingBottom: 60 },
  shellOnly: { minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#090a0f', color: '#e4e4e7' },
  shellCard: { padding: 32, borderRadius: 24, background: '#12131a', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center', maxWidth: 400 },
  shellBackButton: { marginBottom: 14 },
  shellTitle: { fontSize: 16, marginBottom: 16, color: '#a1a1aa' },
  topbar: { height: 64, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(10, 11, 15, 0.7)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100 },
  brandRow: { display: 'flex', alignItems: 'center', gap: 8 },
  logo: { fontSize: 20, fontWeight: 'bold' },
  brand: { fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff' },
  backBtn: { background: 'rgba(255,255,255,0.05)', color: '#e4e4e7', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  main: { maxWidth: 840, margin: '0 auto', padding: '24px 16px' },
  
  hero: { display: 'flex', flexDirection: 'column', gap: 24, padding: 24, borderRadius: 24, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 20 },
  heroMedia: { width: '100%', height: 240, borderRadius: 16, overflow: 'hidden', background: '#12131a', position: 'relative' },
  coverImage: { width: '100%', height: '100%', objectFit: 'cover' },
  coverFallback: { position: 'absolute', inset: 0 },
  heroContent: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' },
  eventKicker: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', padding: '4px 10px', borderRadius: 99, letterSpacing: '0.05em', marginBottom: 16 },
  title: { fontSize: 'clamp(28px, 5vw, 42px)', lineHeight: 1.1, margin: '0 0 12px 0', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff' },
  description: { color: '#a1a1aa', fontSize: 15, lineHeight: 1.6, marginBottom: 20, maxWidth: 680 },
  metaRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 },
  metaChip: { padding: '6px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.04)', fontSize: 13, color: '#d4d4d8' },
  
  hostRow: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)' },
  hostAvatar: { width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14 },
  hostName: { fontWeight: 600, fontSize: 14, color: '#fff' },
  hostEmail: { color: '#71717a', fontSize: 12, marginTop: 1 },
  
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 },
  statCard: { padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' },
  statLabel: { color: '#71717a', fontSize: 12, marginBottom: 6, fontWeight: 500 },
  statValue: { fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff' },
  
  leftStack: { display: 'flex', flexDirection: 'column', gap: 20 },
  contentGrid: { width: '100%' },
  panel: { background: '#111217', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 20, padding: 24 },
  panelHead: { fontSize: 16, fontWeight: 700, marginBottom: 6, color: '#fff' },
  ticketIntro: { color: '#71717a', fontSize: 14, marginBottom: 20 },
  
  ticketGrid: { display: 'flex', flexDirection: 'column', gap: 10 },

  noticeBanner: { padding: '10px 12px', borderRadius: 10, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.12)', color: '#fb923c', fontWeight:700, marginBottom: 10 },
  topNotice: { maxWidth: 840, margin: '12px auto', padding: '12px 16px', borderRadius: 10, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.12)', color: '#fb923c', fontWeight:700, textAlign: 'center' },
  ticketCard: { textAlign: 'left', width: '100%', padding: 16, borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)', color: '#e4e4e7', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 },
  ticketCardTitle: { fontSize: 15, fontWeight: 600, color: '#fff' },
  ticketCardDesc: { color: '#71717a', fontSize: 13, lineHeight: 1.4 },
  radioCircle: { width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', boxSizing: 'border-box' },
  
  breakdownCard: { marginTop: 20, padding: 16, borderRadius: 14, background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: 10 },
  breakdownHead: { fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: '#71717a', letterSpacing: '0.05em' },
  breakdownRow: { display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', fontSize: 13 },
  breakdownTotal: { display: 'flex', justifyContent: 'space-between', color: '#fff', fontSize: 15, fontWeight: 700, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' },
  
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { color: '#a1a1aa', fontSize: 13, fontWeight: 500 },
  input: { width: '100%', boxSizing: 'border-box', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)', color: '#fff', padding: '12px', fontSize: 14 },
  textarea: { width: '100%', boxSizing: 'border-box', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)', color: '#fff', padding: '12px', fontSize: 14, resize: 'vertical' },
  
  submitBtn: { border: 'none', borderRadius: 12, padding: '14px', color: '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  secondaryBtn: { border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px', background: 'transparent', color: '#a1a1aa', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  successBanner: { padding: '12px', borderRadius: 12, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80', marginBottom: 4, fontSize: 14, fontWeight: 500 },
  
  // Custom Venue Containers
  venueImageContainer: { width: '100%', height: 160, borderRadius: 14, overflow: 'hidden', background: 'rgba(0,0,0,0.2)', margin: '12px 0 20px 0' },
  venueImage: { width: '100%', height: '100%', objectFit: 'cover' },
  venuePlaceholder: { width: '100%', height: '100%', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', padding: 16, textAlign: 'center' },

  detailRow: { display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#a1a1aa', fontSize: 14 },
  footerNote: { marginTop: 16, color: '#52525b', fontSize: 12, lineHeight: 1.5 },
}
