import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getApiBaseUrl } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'

const themeMap = {
  minimal:  { bg: ['#10262b', '#081722'], accent: '#5eead4' },
  aurora:   { bg: ['#1a0533', '#0d1f3c'], accent: '#a78bfa' },
  sunrise:  { bg: ['#2d1a0e', '#1f0d1a'], accent: '#fb923c' },
  ocean:    { bg: ['#0a1628', '#061a2e'], accent: '#38bdf8' },
  forest:   { bg: ['#0d2110', '#0a1a0d'], accent: '#4ade80' },
  rose:     { bg: ['#2d0a1a', '#1a0a1a'], accent: '#fb7185' },
  black:    { bg: ['#000000', '#060606'], accent: '#ffffff' },
}

export default function EventOverviewPage({ user = null }) {
  const { eventId } = useParams()
  const navigate    = useNavigate()
  const API_BASE = getApiBaseUrl()
  const { logout, user: authUser } = useAuth()
  const currentUser = user || authUser

  const [event,           setEvent]           = useState(null)
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState('')
  const [editing,         setEditing]         = useState(false)
  const [editForm,        setEditForm]        = useState(null)
  const [editErrors,      setEditErrors]      = useState({ ticketVipPrice: '', ticketTablePrice: '' })
  const [savingEvent,     setSavingEvent]     = useState(false)
  const [savingVis,       setSavingVis]       = useState(false)
  const [inviteEmails,    setInviteEmails]    = useState('')
  const [sendingInvites,  setSendingInvites]  = useState(false)
  const [hostForm,        setHostForm]        = useState({ name:'', email:'', role:'Co-host' })
  const [addingHost,      setAddingHost]      = useState(false)
  const [toast,           setToast]           = useState('')
  const [loggingOut,      setLoggingOut]      = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [rsvpForm, setRsvpForm] = useState({ name: '', email: '', note: '' })
  const [submittingRsvp, setSubmittingRsvp] = useState(false)

  // ── Window Width Hook for Sleek Responsiveness ──
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await logout()
      navigate('/signup', { replace: true })
    } finally {
      setLoggingOut(false)
      setShowLogoutConfirm(false)
    }
  }

  const isTablet = width <= 880
  const isMobile = width <= 600
  const isSmallMobile = width <= 400

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  /* ── load event ── */
  useEffect(() => {
    async function load() {
      setLoading(true); setError('')
      try {
        const token = localStorage.getItem('es_token')
        const res   = await fetch(`${API_BASE}/events/${eventId}`, { headers: { Authorization: `Bearer ${token}` } })
        const payload  = await res.json()
        if (!res.ok) throw new Error(payload.message || 'Failed to load event')
        setEvent(payload.data?.event)
      } catch (err) { setError(err.message) }
      finally       { setLoading(false) }
    }
    load()
  }, [eventId])

  useEffect(() => {
    if (!event) return
    setEditForm({
      title: event.title || '', startDate: event.startDate || '',
      startTime: event.startTime || '', endDate: event.endDate || '',
      endTime: event.endTime || '', location: event.location || '',
      coverImage: event.coverImage || '',
      ticketVipPrice: event?.ticketPrices?.vip ?? '',
      ticketTablePrice: event?.ticketPrices?.table ?? '',
    })
  }, [event])

  useEffect(() => {
    setRsvpForm(prev => ({
      ...prev,
      name: currentUser?.name || prev.name,
      email: currentUser?.email || prev.email,
    }))
  }, [currentUser?.email, currentUser?.name])

  function formatPriceInput(val) {
    const cleaned = String(val || '').replace(/[^0-9.]/g, '').trim()
    if (!cleaned) return ''
    const n = Math.round(Number(cleaned))
    return Number.isFinite(n) ? String(n) : ''
  }

  function validateEditPrice(field, value) {
    const cleaned = String(value || '').replace(/[^0-9.]/g, '').trim()
    setEditErrors(prev => ({ ...prev, [field]: (cleaned === '' || !isNaN(Number(cleaned))) ? '' : 'Enter a valid number' }))
  }

  /* ── actions ── */
  async function handleSaveEvent() {
    if (!editForm) return
    setSavingEvent(true)
    try {
      const token = localStorage.getItem('es_token')
      const payloadBody = { ...editForm }
      // construct ticketPrices if provided
      const vip = parseFloat(String(editForm.ticketVipPrice || '').trim())
      const table = parseFloat(String(editForm.ticketTablePrice || '').trim())
      const tp = {}
      if (!Number.isNaN(vip) && vip > 0) tp.vip = vip
      if (!Number.isNaN(table) && table > 0) tp.table = table
      payloadBody.ticketPrices = Object.keys(tp).length ? tp : null

      const res = await fetch(`${API_BASE}/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body: JSON.stringify(payloadBody),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.message)
      setEvent(payload.data?.event); setEditing(false); showToast('Event saved.')
    } catch (err) { setError(err.message) }
    finally       { setSavingEvent(false) }
  }

  async function handleToggleVisibility() {
    setSavingVis(true)
    try {
      const token = localStorage.getItem('es_token')
      const res = await fetch(`${API_BASE}/events/${eventId}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body: JSON.stringify({ isPublic: !event.isPublic }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.message)
      setEvent(payload.data?.event)
    } catch (err) { setError(err.message) }
    finally       { setSavingVis(false) }
  }

  async function handleSendInvitations() {
    setSendingInvites(true)
    try {
      const token = localStorage.getItem('es_token')
      const res = await fetch(`${API_BASE}/events/${eventId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body: JSON.stringify({ emails: inviteEmails }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.message)
      setEvent(payload.data?.event); setInviteEmails(''); showToast('Invitations sent.')
    } catch (err) { setError(err.message) }
    finally       { setSendingInvites(false) }
  }

  async function handleAddHost() {
    if (!hostForm.name.trim() || !hostForm.email.trim()) { setError('Name and email required'); return }
    setAddingHost(true); setError('')
    try {
      const token = localStorage.getItem('es_token')
      const res = await fetch(`${API_BASE}/events/${eventId}/hosts`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body: JSON.stringify(hostForm),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.message)
      setEvent(payload.data?.event); setHostForm({ name:'', email:'', role:'Co-host' }); showToast('Host added.')
    } catch (err) { setError(err.message) }
    finally       { setAddingHost(false) }
  }

  async function handleCopyLink() {
    const url = `${window.location.origin}/public/events/${event?.id}`
    try {
      if (navigator.share) {
        await navigator.share({
          title: event?.title || 'EventsNest event',
          text: `Check out ${event?.title || 'this event'}`,
          url,
        })
        showToast('Share sheet opened.')
        return
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        showToast('Link copied!')
        return
      }

      const fallbackInput = document.createElement('input')
      fallbackInput.value = url
      fallbackInput.setAttribute('readonly', 'true')
      fallbackInput.style.position = 'fixed'
      fallbackInput.style.left = '-9999px'
      document.body.appendChild(fallbackInput)
      fallbackInput.select()
      document.execCommand('copy')
      document.body.removeChild(fallbackInput)
      showToast('Link copied!')
    } catch {
      showToast(url)
    }
  }

  function handleSocialShare(platform) {
    const url = `${window.location.origin}/public/events/${event?.id}`
    const shareText = `Check out ${event?.title || 'this event'}`
    const encodedUrl = encodeURIComponent(url)
    const encodedText = encodeURIComponent(shareText)

    const shareTargets = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      x: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      chat: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`,
    }

    const targetUrl = shareTargets[platform]
    if (!targetUrl) return

    window.open(targetUrl, '_blank', 'noopener,noreferrer')
  }

  const attendeeEmail = String(rsvpForm.email || currentUser?.email || '').trim().toLowerCase()
  const attendeeName = String(rsvpForm.name || currentUser?.name || '').trim()
  const alreadyRsvped = Array.isArray(event?.rsvps)
    ? event.rsvps.some(rsvp => String(rsvp.email || '').trim().toLowerCase() === attendeeEmail)
    : false

  async function handleSubmitRsvp() {
    if (!attendeeName || !attendeeEmail) {
      showToast('Your name and email are needed to register.')
      return
    }

    if (alreadyRsvped) {
      showToast('You have already registered for this event.')
      return
    }

    setSubmittingRsvp(true)

    try {
      const res = await fetch(`${API_BASE}/events/public/${eventId}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: attendeeName, email: attendeeEmail, note: String(rsvpForm.note || '').trim() }),
      })
      const payload = await res.json()

      if (!res.ok) {
        if (res.status === 409) {
          showToast(payload.message || 'You have already RSVP’d for this event.')
          return
        }
        throw new Error(payload.message || 'Failed to RSVP')
      }

      setEvent(payload.data?.event)
      setRsvpForm(prev => ({ ...prev, note: '' }))
      showToast('RSVP confirmed.')
    } catch (err) {
      showToast(err.message)
    } finally {
      setSubmittingRsvp(false)
    }
  }

  if (loading)           return <LoadingShell />
  if (error && !event)   return <ErrorShell message={error} onBack={() => navigate('/events')} />
  if (!event)            return <ErrorShell message="Event not found" onBack={() => navigate('/events')} />

  const theme        = themeMap[event.theme] || themeMap.minimal
  const rsvpCount    = event.rsvpCount || (Array.isArray(event.rsvps) ? event.rsvps.length : 0)
  const invitedGuests= Array.isArray(event.invitedGuests) ? event.invitedGuests : []
  const shortUrl     = `eventsnest.xyz/${event.id?.slice(0,8) || 'preview'}`

  return (
    <div style={{ ...s.page, background:'#111114' }}>

      {/* ── topbar ── */}
      <header style={{...s.topbar, padding: isMobile ? '0 16px' : '0 28px'}}>
        <div style={s.topbarLeft}>
          <span style={s.logo}>✦</span>
          {!isSmallMobile && <span style={s.brand}>EventsNest</span>}
        </div>
        <div style={{ display: 'flex', gap: '6px', position: 'relative', alignItems: 'center' }}>
          <button style={s.eventPageBtn} onClick={() => navigate(`/public/events/${event.id}`)}>
            {isMobile ? 'Page ↗' : 'Event Page ↗'}
          </button>
          <button style={{...s.adminBtn, marginLeft: isMobile ? 0 : 10}} onClick={() => navigate(`/events/${event.id}/admin`)}>
            {isMobile ? 'Admin' : 'Admin ↗'}
          </button>
          <button
            style={{...s.logoutBtn, marginLeft: isMobile ? 0 : 10, opacity: loggingOut ? 0.7 : 1}}
            onClick={() => setShowLogoutConfirm(v => !v)}
            disabled={loggingOut}
          >
            Logout
          </button>
          {showLogoutConfirm && !loggingOut && (
            <div style={{ ...s.logoutConfirm, top: isMobile ? 54 : 54 }}>
              <div style={s.logoutConfirmText}>Are you sure you want to log out?</div>
              <div style={s.logoutConfirmActions}>
                <button type="button" style={s.logoutCancelBtn} onClick={() => setShowLogoutConfirm(false)}>
                  Cancel
                </button>
                <button type="button" style={s.logoutConfirmBtn} onClick={handleLogout}>
                  Log out
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main style={{...s.main, padding: isMobile ? '16px 16px 60px' : '28px 24px 80px'}}>

        {/* breadcrumb */}
        <div style={s.breadcrumb}>
          <span style={s.breadcrumbLink} onClick={() => navigate('/events')}>Personal</span>
          <span style={s.breadcrumbSep}>›</span>
          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{event.title}</span>
        </div>

        {/* hero row */}
        <div style={{...s.heroRow, flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'flex-start'}}>
          <div>
            <h1 style={{...s.heroTitle, fontSize: isSmallMobile ? '28px' : isMobile ? '34px' : 'clamp(32px,4vw,52px)'}}>{event.title}</h1>
            <div style={s.chips}>
              <Chip>{fmtDateLong(event.startDate)}</Chip>
              <Chip>{fmtTimeRange(event.startTime, event.endTime)}</Chip>
              <Chip>{event.isPublic ? '🌐 Public' : '🔒 Private'}</Chip>
              <Chip>{rsvpCount} RSVPs</Chip>
            </div>
          </div>
          <div style={{...s.heroActions, marginTop: isMobile ? 8 : 0, width: isMobile ? '100%' : 'auto'}}>
            <Btn onClick={() => setEditing(v=>!v)} style={{flex: isMobile ? 1 : 'unset'}}>{editing ? 'Close' : 'Edit Event'}</Btn>
            <Btn ghost onClick={() => navigate(`/events/${event.id}/admin`)} style={{flex: isMobile ? 1 : 'unset'}}>Admin</Btn>
          </div>
        </div>

        {/* tabs */}
        <div style={{...s.tabs, gap: isMobile ? 14 : 24, overflowX: 'auto', whiteSpace: 'nowrap', width: '100%', scrollbarWidth: 'none'}}>
          {['Overview','Guests','Registration','Blasts','Insights'].map((t,i) => (
            <button key={t} style={{ ...s.tab, ...(i===0 ? s.tabActive : {}) }}>{t}</button>
          ))}
        </div>

        {/* quick action cards */}
        <div style={{...s.actionRow, gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(3,1fr)'}}>
          <ActionCard icon="✉" label="Invite Guests"  color="#3b82f6"
            onClick={() => document.getElementById('invite-section')?.scrollIntoView({behavior:'smooth'})} />
          <ActionCard icon="▣" label="Send a Blast"   color="#a855f7"
            onClick={() => document.getElementById('blast-section')?.scrollIntoView({behavior:'smooth'})} />
          <ActionCard icon="↗" label="Share Event"    color="#ec4899"
            onClick={handleCopyLink} />
        </div>

        {toast && <div style={s.toast}>{toast}</div>}
        {error && <div style={s.errorBanner}>{error}</div>}

        {/* ── columns container ── */}
        <div style={{...s.cols, gridTemplateColumns: isTablet ? '1fr' : '1fr 360px'}}>

          {/* ══ LEFT ══ */}
          <div style={s.leftCol}>

            {/* event preview card */}
            <div style={s.previewCard}>
              <div style={{...s.previewTop, flexDirection: isMobile ? 'column' : 'row'}}>
                {/* cover square */}
                <div style={{...s.coverSquare, width: isMobile ? '100%' : 220, height: isMobile ? 240 : 'auto', minHeight: isMobile ? 'unset' : 220}}>
                  {event.coverImage
                    ? <img src={event.coverImage} alt={event.title} style={s.coverImg}/>
                    : <CoverPlaceholder accent={theme.accent}/>
                  }
                </div>

                {/* right / bottom of cover */}
                <div style={s.previewInfo}>
                  <h2 style={s.previewTitle}>{event.title}</h2>

                  {/* date row */}
                  <div style={{...s.previewDateRow, flexDirection: isSmallMobile ? 'column' : 'row', alignItems: isSmallMobile ? 'flex-start' : 'center'}}>
                    <div style={s.dateBadge}>
                      <span style={s.dateMonth}>{getMonth(event.startDate).toUpperCase()}</span>
                      <span style={s.dateDay}>{getDay(event.startDate)}</span>
                    </div>
                    <div style={{marginTop: isSmallMobile ? 8 : 0}}>
                      <div style={s.dateLabel}>{fmtDateLong(event.startDate)}</div>
                      <div style={s.timeLabel}>{fmtTimeRange(event.startTime, event.endTime)}</div>
                    </div>
                  </div>

                  {/* location */}
                  <div style={s.locationRow}>
                    <span style={s.locationIcon}>📍</span>
                    <span style={s.locationText}>{event.location || 'Register to See Address'}</span>
                  </div>

                  {/* hosted by */}
                  <div style={s.hostedBy}>
                    <span style={s.hostedByLabel}>Hosted By</span>
                    <div style={s.hostInlineRow}>
                      <div style={s.hostAvatarSm}>{initials(event.hostName || user?.name)}</div>
                      <span style={s.hostInlineName}>{event.hostName || user?.name || 'Creator'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* registration card */}
              <div style={s.regCard}>
                <div style={s.regLabel}>Registration</div>
                <p style={s.regCopy}>
                  Welcome, <strong>{currentUser?.name || event.hostName || 'Creator'}</strong>! {event.requireApproval ? 'Request access using the form below.' : 'Register below to join the event.'}
                </p>
                <div style={s.regHostRow}>
                  <div style={s.regHostAvatar}>{initials(event.hostName || currentUser?.name)}</div>
                  <div>
                    <div style={s.regHostName}>{event.hostName || currentUser?.name || 'Creator'}</div>
                    <div style={s.regHostEmail}>{event.hostEmail || currentUser?.email || ''}</div>
                  </div>
                </div>
                <div style={s.rsvpForm}>
                  <label style={s.rsvpField}>
                    <span style={s.rsvpLabel}>Name</span>
                    <input
                      type="text"
                      value={rsvpForm.name}
                      onChange={e => setRsvpForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Your full name"
                      style={s.rsvpInput}
                    />
                  </label>
                  <label style={s.rsvpField}>
                    <span style={s.rsvpLabel}>Email</span>
                    <input
                      type="email"
                      value={rsvpForm.email}
                      onChange={e => setRsvpForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="you@example.com"
                      style={s.rsvpInput}
                    />
                  </label>
                  <label style={s.rsvpField}>
                    <span style={s.rsvpLabel}>{event.requireApproval ? 'Why do you want to attend?' : 'Note (optional)'}</span>
                    <textarea
                      value={rsvpForm.note}
                      onChange={e => setRsvpForm(prev => ({ ...prev, note: e.target.value }))}
                      placeholder={event.requireApproval ? 'Tell the host a bit about yourself' : 'Add a short note'}
                      rows={3}
                      style={s.rsvpTextarea}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  style={s.rsvpBtn}
                  onClick={handleSubmitRsvp}
                  disabled={submittingRsvp || alreadyRsvped}
                >
                  {alreadyRsvped ? 'Already Registered' : submittingRsvp ? 'Submitting…' : event.requireApproval ? 'Request Approval' : 'One-Click RSVP'}
                </button>
                {event.requireApproval && (
                  <div style={s.rsvpHint}>Your request will be sent to the host for approval.</div>
                )}
              </div>

              {/* share bar */}
              <div style={{...s.shareBar, flexDirection: isSmallMobile ? 'column' : 'row', height: isSmallMobile ? 'auto' : 48, padding: isSmallMobile ? '12px' : '0 16px', gap: isSmallMobile ? 8 : 0}}>
                <span style={s.shareUrl}>{shortUrl}</span>
                <div style={{display: 'flex', alignItems: 'center', width: isSmallMobile ? '100%' : 'auto', justifyContent: 'space-between', gap: 12}}>
                  <button style={s.shareArrow} onClick={() => navigate(`/public/events/${event.id}`)}>↗</button>
                  {!isSmallMobile && <div style={s.shareSep}/>}
                  <button style={{...s.copyBtn, width: isSmallMobile ? '100%' : 'auto'}} onClick={handleCopyLink}>COPY</button>
                </div>
              </div>
            </div>

            {/* bottom action bar */}
            <div style={{...s.bottomBar, flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 16 : 0, alignItems: isMobile ? 'stretch' : 'center', padding: isMobile ? '16px' : '0 24px'}}>
              <div style={{...s.socialRow, justifyContent: isMobile ? 'center' : 'flex-start'}}>
                <span style={s.shareLabel}>Share Event</span>
                {[
                  { icon: '𝕗', platform: 'facebook', label: 'Share on Facebook' },
                  { icon: '𝕏', platform: 'x', label: 'Share on X' },
                  { icon: 'in', platform: 'linkedin', label: 'Share on LinkedIn' },
                  { icon: '💬', platform: 'chat', label: 'Share via chat' },
                ].map(item => (
                  <button
                    key={item.platform}
                    type="button"
                    style={s.socialBtn}
                    aria-label={item.label}
                    title={item.label}
                    onClick={() => handleSocialShare(item.platform)}
                  >
                    {item.icon}
                  </button>
                ))}
              </div>
              <div style={{...s.bottomActions, justifyContent: isMobile ? 'stretch' : 'flex-end'}}>
                <button style={{...s.bottomBtn, flex: isMobile ? 1 : 'unset'}} onClick={() => setEditing(v=>!v)}>
                  {editing ? 'Close Editor' : 'Edit Event'}
                </button>
                <button style={{...s.bottomBtn, flex: isMobile ? 1 : 'unset'}}>Change Photo</button>
              </div>
            </div>

            {/* edit section */}
            {editing && editForm && (
              <Section title="Edit Event" sub="Update details.">
                <div style={{...s.editGrid, gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)'}}>
                  {[
                    { label:'Title',      key:'title',     type:'text' },
                    { label:'Location',   key:'location',  type:'text' },
                    { label:'Start Date', key:'startDate', type:'date' },
                    { label:'Start Time', key:'startTime', type:'time' },
                    { label:'End Date',   key:'endDate',   type:'date' },
                    { label:'End Time',   key:'endTime',   type:'time' },
                  ].map(f => (
                    <label key={f.key} style={s.editField}>
                      <span style={s.editLabel}>{f.label}</span>
                      <input
                        type={f.type}
                        value={editForm[f.key]}
                        onChange={e => setEditForm(p=>({...p,[f.key]:e.target.value}))}
                        style={s.editInput}
                      />
                    </label>
                  ))}
                  <label style={{ ...s.editField, gridColumn: '1/-1' }}>
                    <span style={s.editLabel}>VIP Price (₦)</span>
                      <input type="text" inputMode="numeric" min="0" step="0.01" value={editForm.ticketVipPrice}
                        onChange={e => { setEditForm(p => ({ ...p, ticketVipPrice: e.target.value })); validateEditPrice('ticketVipPrice', e.target.value) }}
                        onBlur={() => { setEditForm(p => ({ ...p, ticketVipPrice: formatPriceInput(p.ticketVipPrice) })); validateEditPrice('ticketVipPrice', editForm.ticketVipPrice) }}
                        style={s.editInput} placeholder="Leave empty to disable VIP" />
                      {editErrors.ticketVipPrice && <div style={s.inputError}>{editErrors.ticketVipPrice}</div>}
                  </label>
                  <label style={{ ...s.editField, gridColumn: '1/-1' }}>
                    <span style={s.editLabel}>Table (4) Price (₦)</span>
                    <input type="text" inputMode="numeric" min="0" step="0.01" value={editForm.ticketTablePrice}
                      onChange={e => { setEditForm(p => ({ ...p, ticketTablePrice: e.target.value })); validateEditPrice('ticketTablePrice', e.target.value) }}
                      onBlur={() => { setEditForm(p => ({ ...p, ticketTablePrice: formatPriceInput(p.ticketTablePrice) })); validateEditPrice('ticketTablePrice', editForm.ticketTablePrice) }}
                      style={s.editInput} placeholder="Leave empty to disable Table" />
                    {editErrors.ticketTablePrice && <div style={s.inputError}>{editErrors.ticketTablePrice}</div>}
                  </label>
                  <label style={{ ...s.editField, gridColumn:'1/-1' }}>
                    <span style={s.editLabel}>Cover Image</span>
                    <input type="file" accept="image/*" style={s.fileInput}
                      onChange={e=>{
                        const f=e.target.files?.[0]; if(!f) return
                        const r=new FileReader()
                        r.onload=()=>setEditForm(p=>({...p,coverImage:String(r.result||'')}))
                        r.readAsDataURL(f)
                      }}
                    />
                  </label>
                </div>
                <div style={s.editFooter}>
                  <Btn ghost onClick={()=>setEditing(false)}>Cancel</Btn>
                  <Btn onClick={handleSaveEvent} disabled={savingEvent}>
                    {savingEvent ? 'Saving…' : 'Save Changes'}
                  </Btn>
                </div>
              </Section>
            )}

            {/* invite section */}
            <div id="invite-section">
              <Section title="Invitations" sub="Invite guests via email.">
                <textarea
                  placeholder="Enter emails separated by commas or new lines"
                  value={inviteEmails}
                  onChange={e=>setInviteEmails(e.target.value)}
                  rows={4}
                  style={s.textarea}
                />
                <div style={{ marginTop:10 }}>
                  <Btn onClick={handleSendInvitations} disabled={sendingInvites}>
                    {sendingInvites ? 'Sending…' : 'Send Invitations'}
                  </Btn>
                </div>
                {invitedGuests.length === 0
                  ? <EmptyBlock title="No Invitations Sent" body="Invite contacts and past guests." />
                  : <div style={s.inviteList}>
                      {invitedGuests.map(g=>(
                        <div key={g.email+g.sentAt} style={s.inviteItem}>
                          <span>✉</span>
                          <span style={{flex:1, overflow:'hidden', textOverflow:'ellipsis'}}>{g.email}</span>
                          <span style={s.sentAt}>{fmtDate(g.sentAt)}</span>
                        </div>
                      ))}
                    </div>
                }
              </Section>
            </div>

            {/* hosts section */}
            <Section title="Hosts">
              <div style={s.hostCard}>
                <div style={s.hostAvatarLg}>{initials(event.hostName || user?.name)}</div>
                <div style={s.hostCardBody}>
                  <div style={s.hostCardNameRow}>
                    <strong>{event.hostName || user?.name || 'Creator'}</strong>
                    <span style={s.badge}>Creator</span>
                  </div>
                  <div style={{...s.hostCardEmail, overflow:'hidden', textOverflow:'ellipsis'}}>{event.hostEmail || user?.email || ''}</div>
                </div>
              </div>

              <div id="host-form" tabIndex={-1} style={s.hostComposer}>
                <div style={s.hostComposerTitle}>Add a co-host</div>
                <div style={{...s.hostComposerGrid, gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(120px, 1fr))'}}>
                  {['name','email','role'].map(k=>(
                    <input key={k}
                      value={hostForm[k]}
                      onChange={e=>setHostForm(p=>({...p,[k]:e.target.value}))}
                      placeholder={k.charAt(0).toUpperCase()+k.slice(1)}
                      type={k==='email'?'email':'text'}
                      style={s.hostInput}
                    />
                  ))}
                  <Btn onClick={handleAddHost} disabled={addingHost}>
                    {addingHost ? 'Adding…' : 'Add Host'}
                  </Btn>
                </div>
              </div>
            </Section>

            {/* visibility section */}
            <Section title="Visibility & Discovery">
              <div style={s.visCard}>
                <div style={s.visTop}>
                  <div>
                    <div style={s.visCalLabel}>Managing Calendar</div>
                    <div style={s.visCalName}>Your Personal Calendar</div>
                  </div>
                  <span style={{ ...s.visBadge, color: event.isPublic ? '#86efac' : '#fca5a5' }}>
                    {event.isPublic ? '🌐 Public' : '🔒 Private'}
                  </span>
                </div>
                <div style={{...s.visActions, flexDirection: isSmallMobile ? 'column' : 'row'}}>
                  <Btn onClick={handleToggleVisibility} disabled={savingVis} style={{width: isSmallMobile ? '100%' : 'auto'}}>
                    {savingVis ? 'Updating…' : event.isPublic ? 'Change Visibility' : 'Make Public'}
                  </Btn>
                  <Btn ghost style={{width: isSmallMobile ? '100%' : 'auto'}}>Transfer Calendar</Btn>
                </div>
              </div>
            </Section>

            {/* blasts section */}
            <div id="blast-section">
              <Section title="Blasts" sub="Event-wide announcements.">
                <EmptyBlock title="No blasts yet" body="Compose and send a blast to all registered guests." />
              </Section>
            </div>

            <p style={s.footerNote}>
              Submit your event to an EventSphere discovery page for a chance to be featured and reach more people.
            </p>
          </div>

          {/* ══ RIGHT SIDEBAR (Moves down cleanly on mobile) ══ */}
          <aside style={{...s.sidebar, position: isTablet ? 'static' : 'sticky'}}>
            <div style={s.whenCard}>
              <h3 style={s.whenTitle}>When &amp; Where</h3>

              <div style={s.whenDateRow}>
                <div style={s.calBadge}>
                  <span style={s.calMonth}>{getMonth(event.startDate).toUpperCase()}</span>
                  <span style={s.calDay}>{getDay(event.startDate)}</span>
                </div>
                <div>
                  <div style={s.whenDayLabel}>Today</div>
                  <div style={s.whenTime}>{fmtTimeRange(event.startTime, event.endTime)} GMT+1</div>
                </div>
              </div>

              <div style={s.whenDivider}/>

              <div style={s.locationAlert}>
                <div style={s.alertIconBox}>⚠</div>
                <div>
                  <div style={s.alertTitle}>
                    {event.location ? 'Location Set' : 'Location Missing'}
                  </div>
                  <div style={s.alertBody}>
                    {event.location || 'Please enter the location of the event before it starts.'}
                  </div>
                </div>
              </div>

              <div style={s.whenDivider}/>

              <div style={s.sideVisSection}>
                <div style={s.sideVisLabel}>Visibility</div>
                <div style={s.sideVisValue}>{event.isPublic ? 'Public' : 'Private'}</div>
                <div style={s.sideVisCopy}>
                  {event.isPublic
                    ? 'Anyone with the link can discover this event.'
                    : 'Only invited guests can see this event.'}
                </div>
                <button style={s.sideVisBtn} onClick={handleToggleVisibility} disabled={savingVis}>
                  {savingVis ? 'Updating…' : event.isPublic ? 'Make Private' : 'Make Public'}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}

/* ══════════════════════════════════════════
    SMALL RESUSABLE UTILITY COMPONENTS
══════════════════════════════════════════ */
function ActionCard({ icon, label, color, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      style={{ ...s.actionCard, background: hov ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)' }}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      onClick={onClick}
    >
      <div style={{ ...s.actionIconBox, background:`${color}22`, color }}>{icon}</div>
      <span style={s.actionLabel}>{label}</span>
    </button>
  )
}

function CoverPlaceholder({ accent }) {
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center',
      background:`linear-gradient(135deg, ${accent}30 0%, rgba(255,255,255,0.03) 100%)` }}>
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <circle cx="40" cy="40" r="28" stroke={accent} strokeWidth="1.5" opacity=".4"/>
        <circle cx="40" cy="40" r="14" fill={accent} opacity=".15"/>
        <circle cx="40" cy="40" r="6"  fill={accent} opacity=".5"/>
      </svg>
    </div>
  )
}

function Chip({ children }) {
  return <span style={s.chip}>{children}</span>
}

function Btn({ children, onClick, disabled, ghost, small, style }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick} disabled={disabled}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        ...s.btn,
        ...(ghost ? s.btnGhost : {}),
        ...(small ? s.btnSmall : {}),
        opacity: disabled ? .5 : 1,
        background: ghost ? 'transparent' : hov ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.08)',
        ...style
      }}
    >
      {children}
    </button>
  )
}

function Section({ title, sub, action, children }) {
  return (
    <section style={s.section}>
      <div style={s.sectionHead}>
        <div>
          <h3 style={s.sectionTitle}>{title}</h3>
          {sub && <p style={s.sectionSub}>{sub}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      {children}
    </section>
  )
}

function EmptyBlock({ title, body }) {
  return (
    <div style={s.emptyBlock}>
      <div style={s.emptyTitle}>{title}</div>
      <div style={s.emptyBody}>{body}</div>
    </div>
  )
}

function LoadingShell() {
  return (
    <div style={s.shell}>
      <div style={s.shellCard}>
        <div style={{ fontSize:28, marginBottom:12, animation:'spin 1s linear infinite' }}>✦</div>
        <div style={{ color:'#9a9aaa' }}>Loading event...</div>
      </div>
    </div>
  )
}

function ErrorShell({ message, onBack }) {
  return (
    <div style={s.shell}>
      <div style={s.shellCard}>
        <div style={{ fontSize:16, marginBottom:16, color:'#f87171' }}>{message}</div>
        <button style={s.btn} onClick={onBack}>← Back to Events</button>
      </div>
    </div>
  )
}

/* ── date helpers ── */
function fmtDateLong(d) {
  if (!d) return 'Date TBC'
  const date = new Date(d)
  return isNaN(date) ? d : new Intl.DateTimeFormat('en-NG',{weekday:'long',day:'numeric',month:'long'}).format(date)
}
function fmtTimeRange(s,e) {
  if (!s && !e) return 'Time TBC'
  return [s,e].filter(Boolean).join(' - ')
}
function getMonth(d) {
  const date = new Date(d)
  return isNaN(date.getTime()) ? '---' : new Intl.DateTimeFormat('en-NG',{month:'short'}).format(date)
}
function getDay(d) {
  const date = new Date(d)
  return isNaN(date.getTime()) ? '--' : new Intl.DateTimeFormat('en-NG',{day:'2-digit'}).format(date)
}
function initials(name) {
  return String(name||'').split(' ').filter(Boolean).slice(0,2).map(w=>w[0]?.toUpperCase()).join('')||'E'
}
function fmtDate(v) {
  if (!v) return ''
  const d = new Date(v)
  return isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('en-NG',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(d)
}

/* ══════════════════════════════════════════
    STYLES (Adjusted for seamless layout wrapping)
══════════════════════════════════════════ */
const s = {
  page:     { minHeight:'100vh', background:'#111114', color:'#ececf0', fontFamily:"'DM Sans',system-ui,sans-serif", WebkitFontSmoothing:'antialiased' },
  shell:    { minHeight:'100vh', display:'grid', placeItems:'center', background:'#111114', color:'#ececf0', fontFamily:"'DM Sans',system-ui,sans-serif" },
  shellCard:{ padding:32, borderRadius:20, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', textAlign:'center' },

  /* topbar */
  topbar:      { height:60, display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(17,17,20,0.9)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.06)', position:'sticky', top:0, zIndex:50 },
  topbarLeft:  { display:'flex', alignItems:'center', gap:10 },
  logo:        { color:'#a78bfa', fontSize:20 },
  brand:       { fontSize:16, fontWeight:700, letterSpacing:'-.3px' },
  eventPageBtn:{ background:'rgba(255,255,255,0.07)', color:'#ccc', border:'1px solid rgba(255,255,255,0.08)', borderRadius:999, padding:'8px 16px', fontWeight:600, cursor:'pointer', fontSize:13, fontFamily:"'DM Sans',system-ui,sans-serif" },
  adminBtn:    { background:'rgba(167,139,250,0.16)', color:'#ddd6fe', border:'1px solid rgba(167,139,250,0.24)', borderRadius:999, padding:'8px 16px', fontWeight:700, cursor:'pointer', fontSize:13, fontFamily:"'DM Sans',system-ui,sans-serif" },
  logoutBtn:   { background:'rgba(248,113,113,0.14)', color:'#fecaca', border:'1px solid rgba(248,113,113,0.24)', borderRadius:999, padding:'8px 16px', fontWeight:700, cursor:'pointer', fontSize:13, fontFamily:"'DM Sans',system-ui,sans-serif" },
  logoutConfirm: { position:'absolute', right:0, top:54, minWidth:280, maxWidth:'calc(100vw - 24px)', background:'#17171c', border:'1px solid rgba(255,255,255,0.10)', borderRadius:16, padding:16, boxShadow:'0 20px 50px rgba(0,0,0,0.45)', zIndex:80 },
  logoutConfirmText: { fontSize:14, color:'#ececf0', fontWeight:600, lineHeight:1.4, marginBottom:12 },
  logoutConfirmActions: { display:'flex', gap:10, justifyContent:'flex-end', flexWrap:'wrap' },
  logoutCancelBtn: { background:'rgba(255,255,255,0.06)', color:'#ddd', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:'8px 12px', fontWeight:700, cursor:'pointer', fontSize:13, fontFamily:"'DM Sans',system-ui,sans-serif" },
  logoutConfirmBtn: { background:'rgba(248,113,113,0.18)', color:'#fecaca', border:'1px solid rgba(248,113,113,0.28)', borderRadius:10, padding:'8px 12px', fontWeight:800, cursor:'pointer', fontSize:13, fontFamily:"'DM Sans',system-ui,sans-serif" },

  /* layout */
  main:     { maxWidth:1160, margin:'0 auto' },
  cols:     { display:'grid', gap:20, alignItems:'start' },
  leftCol:  { display:'flex', flexDirection:'column', gap:20, minWidth: 0 },
  sidebar:  { top:80 },

  /* breadcrumb */
  breadcrumb:     { display:'flex', alignItems:'center', gap:6, color:'#6b6b7a', fontSize:14, marginBottom:16 },
  breadcrumbLink: { cursor:'pointer', color:'#9a9aaa', transition:'color .15s' },
  breadcrumbSep:  { opacity:.4 },

  /* hero */
  heroRow:    { display:'flex', gap:20, marginBottom:14 },
  heroTitle:  { fontWeight:900, letterSpacing:'-2px', margin:0, lineHeight:1.05, wordBreak: 'break-word' },
  chips:      { display:'flex', gap:8, flexWrap:'wrap', marginTop:12 },
  chip:       { padding:'6px 12px', borderRadius:999, background:'rgba(255,255,255,0.06)', color:'#b0b0be', fontSize:12.5, border:'1px solid rgba(255,255,255,0.05)', fontWeight:500 },
  heroActions:{ display:'flex', gap:8, flexShrink:0 },

  /* tabs */
  tabs:    { display:'flex', borderBottom:'1px solid rgba(255,255,255,0.07)', marginBottom:20 },
  tab:     { background:'none', border:'none', color:'#6b6b7a', padding:'12px 0', fontSize:14.5, fontWeight:500, cursor:'pointer', fontFamily:"'DM Sans',system-ui,sans-serif", transition:'color .15s' },
  tabActive:{ color:'#f0f0f4', borderBottom:'2px solid #f0f0f4', marginBottom:-1 },

  /* action row */
  actionRow: { display:'grid', gap:12, marginBottom:20 },
  actionCard:{ display:'flex', alignItems:'center', gap:14, padding:'0 20px', height:72, borderRadius:16, border:'1px solid rgba(255,255,255,0.06)', cursor:'pointer', transition:'background .15s', fontFamily:"'DM Sans',system-ui,sans-serif", width: '100%', textAlign: 'left' },
  actionIconBox:{ width:38, height:38, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 },
  actionLabel:{ fontSize:15, fontWeight:700, color:'#e0e0ea' },

  /* toast / error */
  toast:       { padding:'10px 16px', borderRadius:12, background:'rgba(94,234,212,0.12)', border:'1px solid rgba(94,234,212,0.2)', color:'#5eead4', fontSize:13, marginBottom:14 },
  errorBanner: { padding:'10px 16px', borderRadius:12, background:'rgba(248,113,113,0.10)', border:'1px solid rgba(248,113,113,0.2)', color:'#f87171', fontSize:13, marginBottom:14 },

  /* preview card */
  previewCard: { background:'#1a1a1f', border:'1px solid rgba(255,255,255,0.07)', borderRadius:20, overflow:'hidden', boxShadow:'0 8px 40px rgba(0,0,0,0.4)' },
  previewTop:  { display:'flex', gap:0, padding:0 },

  /* cover square */
  coverSquare: { flexShrink:0, background:'#222228', position:'relative', overflow:'hidden' },
  coverImg:    { width:'100%', height:'100%', objectFit:'cover', display:'block' },

  /* preview info */
  previewInfo:     { flex:1, padding:'20px 22px', display:'flex', flexDirection:'column', gap:14, minWidth: 0 },
  previewTitle:    { fontSize:24, fontWeight:800, letterSpacing:'-.5px', margin:0, color:'#f0f0f4', wordBreak: 'break-word' },
  previewDateRow:  { display:'flex', gap:12 },
  dateBadge:       { width:54, height:54, borderRadius:12, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.07)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0 },
  dateMonth:       { fontSize:10, color:'#7a7a8a', fontWeight:700 },
  dateDay:         { fontSize:22, fontWeight:800, lineHeight:1.1, color:'#e8e8f0' },
  dateLabel:       { fontSize:14, fontWeight:700, color:'#e8e8f0', marginBottom:2 },
  timeLabel:       { fontSize:13, color:'#9a9aaa' },
  locationRow:     { display:'flex', alignItems:'center', gap:8 },
  locationIcon:    { fontSize:14 },
  locationText:    { fontSize:13.5, color:'#c0c0cc', fontWeight:500, wordBreak: 'break-word' },
  hostedBy:        { marginTop:'auto', paddingTop:8, borderTop:'1px solid rgba(255,255,255,0.06)' },
  hostedByLabel:   { fontSize:11, color:'#5a5a6a', marginBottom:6, fontWeight:600, textTransform:'uppercase', letterSpacing:'.5px' },
  hostInlineRow:   { display:'flex', alignItems: 'center', gap: 8 },
  hostAvatarSm:    { width:24, height:24, borderRadius:999, background:'rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700 },
  hostInlineName:  { fontSize:13.5, color:'#ececf0', fontWeight:600 },

  /* registration card */
  regCard:     { padding:22, background:'rgba(255,255,255,0.02)', borderTop:'1px solid rgba(255,255,255,0.06)', borderBottom:'1px solid rgba(255,255,255,0.06)' },
  regLabel:    { fontSize:12, fontWeight:700, uppercase:true, letterSpacing:'.5px', color:'#7a7a8a', marginBottom:10, textTransform:'uppercase' },
  regCopy:     { fontSize:14, color:'#b0b0be', lineHeight:1.5, margin:'0 0 16px 0' },
  regHostRow:  { display:'flex', alignItems:'center', gap:12, marginBottom:20 },
  regHostAvatar:{ width:40, height:40, borderRadius:999, background:'rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:14 },
  regHostName: { fontSize:14, fontWeight:700, color:'#f0f0f4' },
  regHostEmail:{ fontSize:12.5, color:'#7a7a8a' },
  rsvpForm: { display:'grid', gap:12, marginBottom:14 },
  rsvpField: { display:'grid', gap:6 },
  rsvpLabel: { fontSize:12, fontWeight:700, color:'#9a9aaa' },
  rsvpInput: { width:'100%', padding:'12px 14px', borderRadius:12, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'#f0f0f4', fontFamily:"'DM Sans',system-ui,sans-serif", outline:'none' },
  rsvpTextarea: { width:'100%', padding:'12px 14px', borderRadius:12, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'#f0f0f4', fontFamily:"'DM Sans',system-ui,sans-serif", outline:'none', resize:'vertical', minHeight: 88 },
  rsvpBtn:     { width:'100%', padding:'12px', borderRadius:12, background:'#f0f0f4', color:'#111114', border:'none', fontWeight:700, fontSize:14, cursor:'pointer', transition:'opacity .15s' },
  rsvpHint: { marginTop:10, fontSize:12.5, color:'#9a9aaa', lineHeight:1.45 },

  /* share bar */
  shareBar:    { height:48, padding:'0 16px', display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(0,0,0,0.15)' },
  shareUrl:    { fontSize:13, color:'#8a8a9a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginRight: 8 },
  shareArrow:  { background:'none', border:'none', color:'#6b6b7a', fontSize:14, cursor:'pointer' },
  shareSep:    { width:1, height:16, background:'rgba(255,255,255,0.1)', margin:'0 12px' },
  copyBtn:     { background:'none', border:'none', color:'#a78bfa', fontSize:11, fontWeight:800, letterSpacing:'.5px', cursor:'pointer' },

  /* bottom bar */
  bottomBar:   { display:'flex', justifyContent:'space-between', alignItems:'center', background:'#1a1a1f', border:'1px solid rgba(255,255,255,0.07)', borderRadius:16, padding:'0 24px', height:'auto', minHeight: 56 },
  socialRow:   { display:'flex', alignItems:'center', gap:8 },
  shareLabel:  { fontSize:12, color:'#6b6b7a', marginRight:4, fontWeight:600 },
  socialBtn:   { width:28, height:28, borderRadius:6, background:'rgba(255,255,255,0.05)', border:'none', color:'#9a9aaa', fontSize:12, cursor:'pointer', display:'grid', placeItems:'center' },
  bottomActions:{ display:'flex', gap:8 },
  bottomBtn:   { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'6px 12px', color:'#ccc', fontSize:12.5, fontWeight:600, cursor:'pointer' },

  /* elements */
  btn:         { padding:'10px 18px', borderRadius:10, border:'none', color:'#fff', fontWeight:600, fontSize:14, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans',system-ui,sans-serif" },
  btnGhost:    { border:'1px solid rgba(255,255,255,0.15)', color:'#eee' },
  btnSmall:    { padding:'6px 12px', fontSize:12.5, borderRadius:8 },
  section:     { background:'#141419', border:'1px solid rgba(255,255,255,0.05)', borderRadius:20, padding:24, display:'flex', flexDirection:'column', gap:16 },
  sectionHead: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16 },
  sectionTitle:{ fontSize:18, fontWeight:800, margin:0, color:'#f0f0f4' },
  sectionSub:  { fontSize:13, color:'#7a7a8a', margin:'4px 0 0 0' },
  textarea:    { width:'100%', background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:14, color:'#fff', fontSize:14, fontFamily:'inherit', boxSizing:'border-box', resize:'vertical' },
  emptyBlock:  { padding:'32px 16px', background:'rgba(0,0,0,0.1)', borderRadius:14, border:'1px dashed rgba(255,255,255,0.06)', textAlign:'center' },
  emptyTitle:  { fontSize:14, fontWeight:700, color:'#9a9aaa', marginBottom:4 },
  emptyBody:   { fontSize:12.5, color:'#6b6b7a' },
  inviteList:  { display:'flex', flexDirection:'column', gap:8 },
  inviteItem:  { display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'rgba(255,255,255,0.02)', borderRadius:10, fontSize:13.5 },
  sentAt:      { fontSize:12, color:'#6b6b7a' },
  hostCard:    { display:'flex', alignItems:'center', gap:14, padding:16, background:'rgba(255,255,255,0.03)', borderRadius:14, border:'1px solid rgba(255,255,255,0.05)' },
  hostAvatarLg:{ width:48, height:48, borderRadius:999, background:'rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700 },
  hostCardBody:{ minWidth: 0 },
  hostCardNameRow:{ display:'flex', alignItems:'center', gap:8, marginBottom:2 },
  badge:       { padding:'2px 6px', borderRadius:4, background:'rgba(167,139,250,0.15)', color:'#c084fc', fontSize:10, fontWeight:700 },
  hostCardEmail:{ fontSize:13, color:'#7a7a8a' },
  hostComposer:{ background:'rgba(0,0,0,0.15)', borderRadius:14, padding:16, marginTop:8 },
  hostComposerTitle:{ fontSize:13, fontWeight:700, color:'#9a9aaa', marginBottom:12 },
  hostComposerGrid:{ display:'grid', gap:10 },
  hostInput:   { background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:'8px 12px', color:'#fff', fontSize:13.5 },
  visCard:     { padding:16, background:'rgba(255,255,255,0.03)', borderRadius:14, border:'1px solid rgba(255,255,255,0.05)' },
  visTop:      { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 },
  visCalLabel: { fontSize:11, color:'#6b6b7a', textTransform:'uppercase', fontWeight:600 },
  visCalName:  { fontSize:14, fontWeight:700, color:'#e0e0ea', marginTop:2 },
  visBadge:    { fontSize:12, fontWeight:600, background:'rgba(255,255,255,0.04)', padding:'4px 8px', borderRadius:6 },
  visActions:  { display:'flex', gap:8 },
  footerNote:  { fontSize:12.5, color:'#5a5a6a', textAlign:'center', lineHeight:1.5, margin:'20px 0 0 0' },

  /* sidebar when card */
  whenCard:    { background:'#141419', border:'1px solid rgba(255,255,255,0.05)', borderRadius:20, padding:20 },
  whenTitle:   { fontSize:15, fontWeight:800, margin:'0 0 16px 0', color:'#f0f0f4' },
  whenDateRow: { display:'flex', alignItems:'center', gap:14 },
  calBadge:    { width:48, height:48, borderRadius:10, background:'#222228', border:'1px solid rgba(255,255,255,0.06)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' },
  calMonth:    { fontSize:9, color:'#a78bfa', fontWeight:700 },
  calDay:      { fontSize:18, fontWeight:800, color:'#f0f0f4', lineHeight:1.1 },
  whenDayLabel:{ fontSize:13.5, fontWeight:700, color:'#e0e0ea' },
  whenTime:    { fontSize:12.5, color:'#7a7a8a', marginTop:2 },
  whenDivider: { height:1, background:'rgba(255,255,255,0.05)', margin:'16px 0' },
  locationAlert:{ display:'flex', gap:12 },
  alertIconBox:{ width:28, height:28, borderRadius:999, background:'rgba(234,179,8,0.1)', color:'#eab308', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, flexShrink:0 },
  alertTitle:  { fontSize:13, fontWeight:700, color:'#e0e0ea' },
  alertBody:   { fontSize:12, color:'#7a7a8a', marginTop:2, lineHeight:1.4 },
  sideVisSection:{ display:'flex', flexDirection:'column', gap:4 },
  sideVisLabel:{ fontSize:12, color:'#6b6b7a', fontWeight:600 },
  sideVisValue:{ fontSize:14, fontWeight:700, color:'#e0e0ea' },
  sideVisCopy: { fontSize:12, color:'#7a7a8a', lineHeight:1.4, margin:'4px 0 10px 0' },
  sideVisBtn:  { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.06)', padding:'8px', borderRadius:8, color:'#ccc', fontSize:12, fontWeight:600, cursor:'pointer' },

  /* edit section inner grid */
  editGrid:    { display:'grid', gap:14 },
  editField:   { display:'flex', flexDirection:'column', gap:6 },
  editLabel:   { fontSize:12.5, fontWeight:600, color:'#9a9aaa' },
  editInput:   { background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:13.5, fontFamily:'inherit' },
  fileInput:   { fontSize:13, color:'#7a7a8a' },
  editFooter:  { display:'flex', justifyContent:'flex-end', gap:10, marginTop:10 }
  , inputError: { color: '#fca5a5', marginTop: 6, fontSize: 13, fontWeight: 700 }
}



// FOR AADMIN 
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getApiBaseUrl } from "../services/api.js";
import { deleteAward as apiDeleteAward } from "../services/awards.js";

/* ─── helpers ─── */
function slugify(v) {
  return String(v || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function extractNomineeName(v) {
  if (!v) return "";
  if (typeof v === "string" || typeof v === "number") return String(v).trim();
  if (typeof v !== "object") return "";
  if (typeof v.name === "string" || typeof v.name === "number")
    return String(v.name).trim();
  if (v.name && typeof v.name === "object") {
    return String(v.name.name || v.name.label || v.name.value || "").trim();
  }
  return String(
    v.nominee || v.label || v.value || v.title || v.text || v.fullName || "",
  ).trim();
}
function extractNomineeImageUrl(v) {
  if (!v || typeof v !== "object") return "";
  const img = v.image || v.photo || v.picture || v.avatar || v.imageUrl || "";
  if (typeof img === "string") return img.trim();
  if (img && typeof img === "object")
    return String(img.url || img.src || img.path || img.value || "").trim();
  return "";
}
function normalizeNominees(input) {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const objectCandidates = [
      input.nominees,
      input.contestants,
      input.items,
      input.data?.nominees,
      input.data?.contestants,
      input.data?.items,
      input.results,
      input.list,
    ].find(Array.isArray);

    if (objectCandidates) return normalizeNominees(objectCandidates);

    const values = Object.values(input);
    if (
      values.some(
        (value) =>
          typeof value === "string" ||
          typeof value === "number" ||
          (value &&
            typeof value === "object" &&
            (value.name ||
              value.label ||
              value.value ||
              value.image ||
              value.photo ||
              value.picture ||
              value.avatar ||
              value.imageUrl)),
      )
    ) {
      return normalizeNominees(values);
    }
  }

  if (Array.isArray(input)) {
    return input
      .map((item) => {
        if (!item) return null;
        if (typeof item === "string") {
          const n = item.trim();
          return n ? { name: n, imageUrl: "", slug: slugify(n) } : null;
        }
        const n = extractNomineeName(item);
        if (!n) return null;
        return {
          name: n,
          imageUrl: extractNomineeImageUrl(item),
          slug: item.slug || slugify(n),
        };
      })
      .filter(Boolean);
  }
  if (typeof input === "string") {
    return input
      .split(/\r?\n|,/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((n) => ({ name: n, imageUrl: "", slug: slugify(n) }));
  }
  return [];
}
function countNomineeVotes(award, nominee) {
  const votes = Array.isArray(award?.votes) ? award.votes : [];
  const targetName = extractNomineeName(nominee).toLowerCase();
  const targetSlug = slugify(nominee?.slug || extractNomineeName(nominee));
  return votes.reduce((total, vote) => {
    const vn =
      vote?.nominee ??
      vote?.nomineeName ??
      vote?.candidate ??
      vote?.choice ??
      "";
    const voteName =
      extractNomineeName(vn).toLowerCase() ||
      String(vn || "")
        .trim()
        .toLowerCase();
    const voteSlug = slugify(vn?.slug || extractNomineeName(vn) || vn);
    return voteName === targetName || voteSlug === targetSlug
      ? total + Number(vote.quantity || 1)
      : total;
  }, 0);
}

function getAwardNominees(award) {
  return normalizeNominees(
    award?.nominees ||
      award?.contestants ||
      award?.items ||
      award?.data?.nominees ||
      award?.data?.contestants ||
      award?.data?.items ||
      award?.results ||
      award?.list ||
      [],
  );
}

function normalizeTicket(ticket) {
  return {
    id: ticket?.id || ticket?._id || ticket?.ticketId || String(ticket?.ticketId || ""),
    ticketId: ticket?.ticketId || "",
    eventId: ticket?.eventId || "",
    attendeeName: ticket?.attendeeName || "",
    attendeeEmail: ticket?.attendeeEmail || "",
    ticketType: ticket?.ticketType || "",
    price: ticket?.price ?? 0,
    amountPaid: ticket?.amountPaid ?? 0,
    status: ticket?.status || "pending",
    paymentReference: ticket?.paymentReference || "",
    checkedInAt: ticket?.checkedInAt || null,
    createdAt: ticket?.createdAt || null,
  };
}

function buildAdminData({ event, tickets = [], awards = [] }) {
  const normalizedTickets = tickets.map(normalizeTicket);
  const paidTickets = normalizedTickets.filter(
    (ticket) => ticket.status === "confirmed" && Number(ticket.price || 0) > 0,
  );
  const freeTickets = normalizedTickets.filter(
    (ticket) => ticket.status === "confirmed" && Number(ticket.price || 0) <= 0,
  );
  const scannedTickets = normalizedTickets.filter(
    (ticket) => ticket.status === "checked-in",
  );
  const unscannedTickets = normalizedTickets.filter(
    (ticket) => ticket.status === "confirmed",
  );

  return {
    event,
    tickets: normalizedTickets,
    paidCount: paidTickets.length,
    paidTickets,
    freeCount: freeTickets.length,
    scannedCount: scannedTickets.length,
    unscannedCount: unscannedTickets.length,
    totalTickets: normalizedTickets.length,
    ticketCount: normalizedTickets.length,
    totalTicketCount: normalizedTickets.length,
    scannedTickets,
    unscannedTickets,
    awards,
  };
}

export default function AdminEventPage({ user = null }) {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const API_BASE = getApiBaseUrl();
  const nomineeFileRefs = useRef([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [data, setData] = useState(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    nominees: [],
  });
  const [deleting, setDeleting] = useState(null); // awardId being deleted
  const [editingAwardId, setEditingAwardId] = useState(null);
  const [awardEdits, setAwardEdits] = useState(null);
  const [savingAwardEdit, setSavingAwardEdit] = useState(false);
  const [editingNominee, setEditingNominee] = useState(null);
  const [nomineeEdits, setNomineeEdits] = useState(null);
  const [savingNomineeEdit, setSavingNomineeEdit] = useState(false);
  const [nomineeError, setNomineeError] = useState("");

  useEffect(() => {
    async function readJson(response) {
      return response.json().catch(() => ({}));
    }

    async function load() {
      setLoading(true);
      setError("");

      try {
        const token = localStorage.getItem("es_token");
        const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

        const [eventRes, ticketsRes, awardsRes] = await Promise.all([
          fetch(`${API_BASE}/events/${eventId}`, { headers: authHeaders }),
          fetch(`${API_BASE}/tickets/events/${eventId}`, { headers: authHeaders }),
          fetch(`${API_BASE}/awards/events/${eventId}`, { headers: authHeaders }),
        ]);

        const [eventPayload, ticketsPayload, awardsPayload] = await Promise.all([
          readJson(eventRes),
          readJson(ticketsRes),
          readJson(awardsRes),
        ]);

        if (!eventRes.ok) {
          throw new Error(eventPayload.message || "Failed to load event");
        }

        const event = eventPayload?.data?.event;
        if (!event) {
          throw new Error("Admin event data not found");
        }

        const tickets = ticketsRes.ok ? ticketsPayload?.data?.tickets || [] : [];
        const awards = awardsRes.ok ? awardsPayload?.data?.awards || [] : [];

        setData(buildAdminData({ event, tickets, awards }));
        setForm({ title: "", description: "", nominees: [] });

        const problems = [];
        if (!ticketsRes.ok) problems.push("tickets");
        if (!awardsRes.ok) problems.push("awards");
        if (problems.length > 0) {
          setError(`Loaded event data, but ${problems.join(" and ")} could not be fetched.`);
        }
      } catch (err) {
        setError(err.message || "Failed to load admin data");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [API_BASE, eventId]);

  async function handleCreateAward(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const token = localStorage.getItem("es_token");
      const res = await fetch(`${API_BASE}/awards/events/${eventId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          nominees: form.nominees
            .map((n) => ({
              name: n.name.trim(),
              imageUrl: n.imageUrl.trim(),
              slug: slugify(n.name),
            }))
            .filter((n) => n.name),
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Failed to create award");
      setSuccess("Award created successfully.");
      setForm({ title: "", description: "", nominees: [] });
      setData((prev) =>
        prev
          ? {
              ...prev,
              awards: [
                payload.data?.award,
                ...(Array.isArray(prev.awards) ? prev.awards : []),
              ],
            }
          : prev,
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAward(awardId, awardTitle) {
    if (!window.confirm(`Delete "${awardTitle}"? This cannot be undone.`))
      return;
    setDeleting(awardId);
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiDeleteAward(eventId, awardId);
      setData((prev) =>
        prev
          ? {
              ...prev,
              awards: (Array.isArray(prev.awards) ? prev.awards : []).filter(
                (a) => a.id !== awardId,
              ),
            }
          : prev,
      );
      setSuccess("Award deleted.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setDeleting(null);
    }
  }

  function handleNomineeFileChange(index, file) {
    if (!file || !file.type?.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({
        ...prev,
        nominees: prev.nominees.map((n, i) =>
          i === index ? { ...n, imageUrl: String(reader.result || "") } : n,
        ),
      }));
    };
    reader.readAsDataURL(file);
  }

  function openNomineeEdit(award, nominee, nomineeIndex) {
    setNomineeError("");
    setEditingNominee({ awardId: award.id, nomineeIndex, mode: "edit" });
    setNomineeEdits({
      name: nominee?.name || "",
      imageUrl: nominee?.imageUrl || "",
    });
  }

  function openNomineeAdd(award) {
    setNomineeError("");
    setEditingNominee({ awardId: award.id, nomineeIndex: null, mode: "add" });
    setNomineeEdits({
      name: "",
      imageUrl: "",
    });
  }

  async function handleSaveNomineeEdit() {
    if (!editingNominee || !nomineeEdits) return;
    if (!window.confirm("Update this nominee?")) return;
    setNomineeError("");
    try {
      setSavingNomineeEdit(true);

      const award = safeAwards.find(
        (item) => String(item.id) === String(editingNominee.awardId),
      );
      if (!award) {
        throw new Error("Award not found");
      }

      const updatedNominees = getAwardNominees(award).map((nominee, index) => {
        if (
          editingNominee.mode !== "edit" ||
          index !== editingNominee.nomineeIndex
        )
          return nominee;
        return {
          ...nominee,
          name: nomineeEdits.name,
          imageUrl: nomineeEdits.imageUrl,
        };
      });

      if (editingNominee.mode === "add") {
        const nomineeName = String(nomineeEdits.name || "").trim();
        if (!nomineeName) {
          throw new Error("Nominee name is required");
        }
        updatedNominees.push({
          name: nomineeName,
          imageUrl: String(nomineeEdits.imageUrl || "").trim(),
          slug: slugify(nomineeName),
        });
      }

      const token = localStorage.getItem("es_token");
      const res = await fetch(
        `${API_BASE}/awards/events/${eventId}/${editingNominee.awardId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: award.title,
            description: award.description,
            nominees: updatedNominees,
          }),
        },
      );
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.message || "Failed to update nominee");
      }

      const updatedAward = payload.data?.award || payload.data || payload;
      setData((prev) => {
        if (!prev) return prev;
        const nextAwards = Array.isArray(prev.awards)
          ? prev.awards.map((item) =>
              String(item.id) === String(updatedAward.id) ? updatedAward : item,
            )
          : prev.awards;

        return { ...prev, awards: nextAwards };
      });

      setSuccess(
        editingNominee.mode === "add"
          ? "Nominee added successfully."
          : "Updated successfully",
      );
      setEditingNominee(null);
      setNomineeEdits(null);
    } catch (err) {
      setNomineeError(err.message);
    } finally {
      setSavingNomineeEdit(false);
    }
  }

  if (loading) return <Shell message="Loading admin dashboard…" />;
  if (error && !data)
    return (
      <Shell
        message={error}
        actionLabel="Back to Events"
        onAction={() => navigate("/events")}
      />
    );
  if (!data)
    return (
      <Shell
        message="Admin data not found"
        actionLabel="Back to Events"
        onAction={() => navigate("/events")}
      />
    );

  const {
    event,
  paidCount,
  freeCount,
  scannedCount = 0,
  unscannedCount = 0,
  totalTickets = 0,
  ticketCount = 0,
  totalTicketCount = 0,
  paidTickets = [],
  scannedTickets = [],
  unscannedTickets = [],
  awards = [],
  } = data;
  const resolvedTotalTickets =
  Number(totalTickets || ticketCount || totalTicketCount || 0);
  const safeAwards = Array.isArray(awards) ? awards : [];
  const vipPaidCount = paidTickets.filter(
    (ticket) => String(ticket?.ticketType || "").toLowerCase() === "vip",
  ).length;
  const tablePaidCount = paidTickets.filter(
    (ticket) => String(ticket?.ticketType || "").toLowerCase() === "table",
  ).length;

  const currentNominees =
    form.nominees.length > 0 ? form.nominees : [{ name: "", imageUrl: "" }];
  const nomineesByAward = safeAwards.map((award) => ({
    award,
    nominees: getAwardNominees(award),
  }));
  const totalNominees = nomineesByAward.reduce(
    (total, group) => total + group.nominees.length,
    0,
  );

  const isOrganizer = String(event.organizerId) === String(user?.userId);
  const isCoHost = Boolean(
    user?.email &&
    Array.isArray(event.coHosts) &&
    event.coHosts.some(
      (h) =>
        String(h.email || "").toLowerCase() ===
        String(user.email || "").toLowerCase(),
    ),
  );
  const canManageEvent = isOrganizer || isCoHost;

  return (
    <div style={A.page}>
      {/* ─── TOPBAR ─── */}
      <header style={A.topbar}>
        <div>
          <div style={A.kicker}>Admin Dashboard</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1 style={A.pageTitle}>{event.title}</h1>
            {isCoHost && !isOrganizer && (
              <span style={A.coHostBadge}>Co-host</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            style={A.ghostBtn}
            onClick={() => navigate(`/events/${eventId}`)}
          >
            ← Back to Event
          </button>
          <button
            style={A.accentBtn}
            onClick={() => navigate(`/events/${eventId}/scan`)}
          >
            📷 Scanner
          </button>
        </div>
      </header>

      <main style={A.main}>
        {/* ─── STATS ─── */}
        <div style={A.statsGrid}>
          {[
            { label: "Paid Tickets", value: paidCount, color: "#a78bfa" },
            { label: "VIP Paid", value: vipPaidCount, color: "#c084fc" },
            { label: "Table Paid", value: tablePaidCount, color: "#f472b6" },
            { label: "Free Tickets", value: freeCount, color: "#38bdf8" },
            { label: "Checked In", value: scannedCount, color: "#4ade80" },
            { label: "Not Scanned", value: unscannedCount, color: "#fb7185" },
            { label: "Awards", value: safeAwards.length, color: "#fbbf24" },
            {
              label: "Total Votes",
              value: safeAwards.reduce(
                (t, a) =>
                  t + Number(a.totalVotes ?? a.votesCount ?? a.voteCount ?? 0),
                0,
              ),
              color: "#fb923c",
            },
            { label: "Total Tickets", value: resolvedTotalTickets, color: "#60a5fa" },
          ].map((s) => (
            <div key={s.label} style={A.statCard}>
              <div style={A.statLabel}>{s.label}</div>
              <div style={{ ...A.statValue, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ─── MAIN GRID ─── */}
        <div style={A.grid}>
          {/* CREATE AWARD */}
          <div style={A.panel}>
            <div style={A.panelHead}>
              <span style={A.panelIcon}>🏆</span> Create Award
            </div>
            {success && <div style={A.successBanner}>{success}</div>}
            {error && <div style={A.errorBanner}>{error}</div>}

            <form
              onSubmit={handleCreateAward}
              style={{ display: "grid", gap: 14 }}
            >
              <FormField label="Award Title">
                <input
                  value={form.title}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, title: e.target.value }))
                  }
                  style={A.input}
                  placeholder="e.g. Best Dressed"
                  required
                />
              </FormField>
              <FormField label="Description (optional)">
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  style={{ ...A.input, ...A.textarea }}
                  rows={3}
                  placeholder="Describe this award category"
                />
              </FormField>

              <FormField label={`Nominees (${currentNominees.length}/6)`}>
                <div style={{ display: "grid", gap: 10 }}>
                  {currentNominees.map((nominee, index) => (
                    <div key={index} style={A.nomineeCard}>
                      {/* thumbnail preview */}
                      {nominee.imageUrl && (
                        <img
                          src={nominee.imageUrl}
                          alt="preview"
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            objectFit: "cover",
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <div style={{ flex: 1, display: "grid", gap: 8 }}>
                        <input
                          value={nominee.name}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              nominees: currentNominees.map((n, i) =>
                                i === index
                                  ? { ...n, name: e.target.value }
                                  : n,
                              ),
                            }))
                          }
                          style={A.input}
                          placeholder={`Nominee ${index + 1} name`}
                          required={index === 0}
                        />
                        <input
                          value={nominee.imageUrl}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              nominees: currentNominees.map((n, i) =>
                                i === index
                                  ? { ...n, imageUrl: e.target.value }
                                  : n,
                              ),
                            }))
                          }
                          style={A.input}
                          placeholder="Photo URL (optional)"
                        />
                        <div
                          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                        >
                          <button
                            type="button"
                            style={A.ghostSmBtn}
                            onClick={() =>
                              nomineeFileRefs.current[index]?.click()
                            }
                          >
                            📱 Upload from phone
                          </button>
                          {nominee.imageUrl && (
                            <button
                              type="button"
                              style={A.ghostSmBtn}
                              onClick={() =>
                                setForm((p) => ({
                                  ...p,
                                  nominees: currentNominees.map((n, i) =>
                                    i === index ? { ...n, imageUrl: "" } : n,
                                  ),
                                }))
                              }
                            >
                              ✕ Clear photo
                            </button>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        style={{
                          ...A.dangerSmBtn,
                          alignSelf: "flex-start",
                          flexShrink: 0,
                        }}
                        disabled={currentNominees.length === 1}
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            nominees: currentNominees.filter(
                              (_, i) => i !== index,
                            ),
                          }))
                        }
                      >
                        Remove
                      </button>
                      <input
                        ref={(el) => {
                          nomineeFileRefs.current[index] = el;
                        }}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(e) =>
                          handleNomineeFileChange(index, e.target.files?.[0])
                        }
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    style={A.addNomineeBtn}
                    disabled={currentNominees.length >= 6}
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        nominees: [
                          ...currentNominees,
                          { name: "", imageUrl: "" },
                        ].slice(0, 6),
                      }))
                    }
                  >
                    + Add Nominee
                  </button>
                </div>
              </FormField>

              <p style={A.helperText}>
                Up to 6 nominees. Paste a photo URL or use the phone picker.
              </p>
              <button type="submit" style={A.primaryBtn} disabled={saving}>
                {saving ? "Creating…" : "Create Award"}
              </button>
            </form>
          </div>

          {/* PAID ATTENDEES */}
          <div style={A.panel}>
            <div style={A.panelHead}>
              <span style={A.panelIcon}>💳</span> Paid Attendees{" "}
              <span style={A.countBadge}>{paidTickets.length}</span>
            </div>
            <TicketList tickets={paidTickets} type="paid" />
          </div>

          {/* CHECKED-IN */}
          <div style={A.panel}>
            <div style={A.panelHead}>
              <span style={A.panelIcon}>✅</span> Checked In{" "}
              <span style={A.countBadge}>{scannedTickets.length}</span>
            </div>
            <TicketList tickets={scannedTickets} type="scanned" />
          </div>

          {/* NOT SCANNED */}
          <div style={A.panel}>
            <div style={A.panelHead}>
              <span style={A.panelIcon}>⏳</span> Not Scanned Yet{" "}
              <span style={A.countBadge}>{unscannedTickets.length}</span>
            </div>
            <TicketList tickets={unscannedTickets} type="unscanned" />
          </div>

          {/* AWARDS & VOTES — full width */}
          <div style={A.panelWide}>
            <div style={A.panelHead}>
              <span style={A.panelIcon}>🏅</span> Awards & Votes{" "}
              <span style={A.countBadge}>{safeAwards.length}</span>
            </div>
            {safeAwards.length === 0 ? (
              <p style={A.empty}>
                No awards created yet. Use the form on the left to create one.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                {safeAwards.map((award) => {
                  const nominees = getAwardNominees(award);
                  const totalAwardVotes =
                    Number(
                      award.totalVotes ??
                        award.votesCount ??
                        award.voteCount ??
                        0,
                    ) ||
                    nominees.reduce((t, n) => t + Number(n.voteCount || 0), 0);
                  return (
                    <div key={award.id} style={A.awardCard}>
                      {/* award header */}
                      <div style={A.awardHeader}>
                        {editingAwardId === award.id ? (
                          <div style={{ flex: 1 }}>
                            <input
                              value={awardEdits?.title || ""}
                              onChange={(e) =>
                                setAwardEdits((p) => ({
                                  ...p,
                                  title: e.target.value,
                                }))
                              }
                              style={{ ...A.input, marginBottom: 8 }}
                              placeholder="Award title"
                            />
                            <textarea
                              value={awardEdits?.description || ""}
                              onChange={(e) =>
                                setAwardEdits((p) => ({
                                  ...p,
                                  description: e.target.value,
                                }))
                              }
                              style={{
                                ...A.input,
                                ...A.textarea,
                                marginBottom: 8,
                              }}
                              rows={2}
                              placeholder="Description (optional)"
                            />
                          </div>
                        ) : (
                          <div>
                            <div style={A.awardTitle}>{award.title}</div>
                            {award.description && (
                              <div style={A.awardDesc}>{award.description}</div>
                            )}
                            <div style={A.awardMeta}>
                              {totalAwardVotes} total votes · {nominees.length}{" "}
                              nominees
                            </div>
                          </div>
                        )}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          {editingAwardId === award.id ? (
                            <>
                              <button
                                style={A.ghostSmBtn}
                                disabled={savingAwardEdit}
                                onClick={async () => {
                                  // save
                                  try {
                                    setSavingAwardEdit(true);
                                    setError("");
                                    setSuccess("");
                                    const token =
                                      localStorage.getItem("es_token");
                                    const res = await fetch(
                                      `${API_BASE}/awards/events/${eventId}/${award.id}`,
                                      {
                                        method: "PATCH",
                                        headers: {
                                          "Content-Type": "application/json",
                                          Authorization: `Bearer ${token}`,
                                        },
                                        body: JSON.stringify({
                                          title: awardEdits.title,
                                          description: awardEdits.description,
                                        }),
                                      },
                                    );
                                    const payload = await res.json();
                                    if (!res.ok)
                                      throw new Error(
                                        payload.message ||
                                          "Failed to update award",
                                      );
                                    // replace award in data
                                    setData((prev) => {
                                      if (!prev) return prev;
                                      const newAwards = (
                                        Array.isArray(prev.awards)
                                          ? prev.awards
                                          : []
                                      ).map((a) =>
                                        a.id === award.id
                                          ? payload.data?.award || payload.data
                                          : a,
                                      );
                                      return { ...prev, awards: newAwards };
                                    });
                                    setSuccess("Award updated.");
                                    setEditingAwardId(null);
                                    setAwardEdits(null);
                                  } catch (err) {
                                    setError(err.message);
                                  } finally {
                                    setSavingAwardEdit(false);
                                  }
                                }}
                              >
                                Save
                              </button>
                              <button
                                style={A.ghostSmBtn}
                                onClick={() => {
                                  setEditingAwardId(null);
                                  setAwardEdits(null);
                                }}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                style={A.ghostSmBtn}
                                onClick={() => {
                                  setEditingAwardId(award.id);
                                  setAwardEdits({
                                    title: award.title || "",
                                    description: award.description || "",
                                  });
                                }}
                              >
                                Edit
                              </button>
                              <button
                                style={A.ghostSmBtn}
                                onClick={() => openNomineeAdd(award)}
                              >
                                + Add nominee
                              </button>
                              {/* delete button commented out; keep for future */}
                            </>
                          )}
                        </div>
                      </div>

                      {/* nominee leaderboard */}
                      <div style={A.nomineeLeaderboard}>
                        {nominees.length === 0 ? (
                          <p style={A.empty}>No nominees.</p>
                        ) : (
                          nominees
                            .map((n) => ({
                              ...n,
                              votes:
                                Number(n.voteCount || 0) ||
                                countNomineeVotes(award, n),
                            }))
                            .sort((a, b) => b.votes - a.votes)
                            .map((n, rank) => {
                              const pct =
                                totalAwardVotes > 0
                                  ? Math.round(
                                      (n.votes / totalAwardVotes) * 100,
                                    )
                                  : 0;
                              const isLeader = rank === 0 && n.votes > 0;
                              return (
                                <div
                                  key={n.slug || n.name}
                                  style={{
                                    ...A.nomineeRow,
                                    ...(isLeader ? A.nomineeRowLeader : {}),
                                  }}
                                >
                                  {/* rank */}
                                  <div
                                    style={{
                                      ...A.rankBadge,
                                      ...(rank < 3
                                        ? {
                                            background:
                                              ["#fbbf24", "#9ca3af", "#f97316"][
                                                rank
                                              ] + "22",
                                            color: [
                                              "#fbbf24",
                                              "#9ca3af",
                                              "#f97316",
                                            ][rank],
                                          }
                                        : {}),
                                    }}
                                  >
                                    #{rank + 1}
                                  </div>
                                  {/* avatar */}
                                  {n.imageUrl ? (
                                    <img
                                      src={n.imageUrl}
                                      alt={n.name}
                                      style={A.nomineeAvatar}
                                    />
                                  ) : (
                                    <div style={A.nomineeAvatarFb}>
                                      {String(n.name).charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  {/* name + bar */}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={A.nomineeName}>
                                      {n.name}
                                      {isLeader && (
                                        <span style={A.leaderTag}>
                                          👑 Leading
                                        </span>
                                      )}
                                    </div>
                                    <div style={A.barTrack}>
                                      <div
                                        style={{
                                          ...A.barFill,
                                          width: `${pct}%`,
                                          background: isLeader
                                            ? "#a78bfa"
                                            : "rgba(255,255,255,0.25)",
                                        }}
                                      />
                                    </div>
                                  </div>
                                  {/* vote count */}
                                  <div style={A.nomineeVotes}>
                                    <span
                                      style={{
                                        ...A.voteCount,
                                        ...(isLeader
                                          ? { color: "#a78bfa" }
                                          : {}),
                                      }}
                                    >
                                      {n.votes}
                                    </span>
                                    <span style={A.votePct}>{pct}%</span>
                                  </div>
                                </div>
                              );
                            })
                        )}
                      </div>

                      {/* recent votes */}
                      {(award.votes || []).length > 0 && (
                        <div style={A.recentVotes}>
                          <div style={A.recentVotesLabel}>Recent votes</div>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            {(award.votes || []).slice(0, 5).map((v, i) => (
                              <div key={i} style={A.voteChip}>
                                <strong>{v.name || v.email}</strong> →{" "}
                                {v.nominee} × {v.quantity || 1}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* NOMINEES — full width */}
          <div style={A.panelWide}>
            <div style={A.panelHead}>
              <span style={A.panelIcon}>🧿</span> Nominees{" "}
              <span style={A.countBadge}>{totalNominees}</span>
            </div>
            {totalNominees === 0 ? (
              <p style={A.empty}>No nominees yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                {nomineesByAward.map((group) => (
                  <div key={group.award.id} style={A.nomineeGroup}>
                    <div style={A.nomineeGroupTitle}>{group.award.title}</div>
                    {group.nominees.length === 0 ? (
                      <p style={A.empty}>No nominees for this award.</p>
                    ) : (
                      <div style={A.nomineeGrid}>
                        {group.nominees.map((nominee, nomineeIndex) => {
                          return (
                            <div key={nominee.id} style={A.nomineeCardLg}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 12,
                                }}
                              >
                                {nominee.imageUrl ? (
                                  <img
                                    src={nominee.imageUrl}
                                    alt={nominee.name}
                                    style={A.nomineeAvatarLg}
                                  />
                                ) : (
                                  <div style={A.nomineeAvatarFbLg}>
                                    {String(nominee.name || "N")
                                      .charAt(0)
                                      .toUpperCase()}
                                  </div>
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={A.nomineeNameLg}>
                                    {nominee.name}
                                  </div>
                                  {nominee.category && (
                                    <div style={A.nomineeMeta}>
                                      {nominee.category}
                                    </div>
                                  )}
                                  <div style={A.nomineeMeta}>
                                    Votes: {nominee.voteCount || 0} · Voters:{" "}
                                    {nominee.voterCount || 0}
                                  </div>
                                </div>
                              </div>
                              <div style={A.nomineeActions}>
                                <button
                                  style={{
                                    ...A.ghostSmBtn,
                                    opacity: canManageEvent ? 1 : 0.5,
                                  }}
                                  disabled={!canManageEvent}
                                  onClick={() =>
                                    openNomineeEdit(
                                      group.award,
                                      nominee,
                                      nomineeIndex,
                                    )
                                  }
                                >
                                  Edit
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {editingNominee && nomineeEdits && (
        <div style={A.modalOverlay}>
          <div style={A.modalCard}>
            <div style={A.modalHeader}>
              <div>
                <div style={A.modalTitle}>
                  {editingNominee.mode === "add"
                    ? "Add Nominee"
                    : "Edit Nominee"}
                </div>
                <div style={A.modalSub}>
                  Organizer and co-hosts can manage nominees for this event.
                </div>
              </div>
              <button
                style={A.ghostSmBtn}
                onClick={() => {
                  setEditingNominee(null);
                  setNomineeEdits(null);
                  setNomineeError("");
                }}
              >
                Close
              </button>
            </div>

            {nomineeError && <div style={A.errorBanner}>{nomineeError}</div>}

            <div style={A.modalBody}>
              <FormField label="Nominee Name">
                <input
                  value={nomineeEdits.name}
                  onChange={(e) =>
                    setNomineeEdits((p) => ({ ...p, name: e.target.value }))
                  }
                  style={A.input}
                />
              </FormField>
              <FormField label="Image URL">
                <input
                  value={nomineeEdits.imageUrl}
                  onChange={(e) =>
                    setNomineeEdits((p) => ({ ...p, imageUrl: e.target.value }))
                  }
                  style={A.input}
                />
              </FormField>
            </div>

            <div style={A.modalFooter}>
              <button
                style={A.ghostSmBtn}
                onClick={() => {
                  setEditingNominee(null);
                  setNomineeEdits(null);
                  setNomineeError("");
                }}
              >
                Cancel
              </button>
              <button
                style={A.accentBtn}
                disabled={savingNomineeEdit}
                onClick={handleSaveNomineeEdit}
              >
                {savingNomineeEdit
                  ? "Saving…"
                  : editingNominee.mode === "add"
                    ? "Add Nominee"
                    : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── sub-components ─── */
function Shell({ message, actionLabel, onAction }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0f0f13",
        color: "#f1f1f5",
        fontFamily: "'DM Sans',system-ui,sans-serif",
        padding: 16,
      }}
    >
      <div
        style={{
          padding: 32,
          borderRadius: 20,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
          textAlign: "center",
          maxWidth: 400,
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <div style={{ fontSize: 18, marginBottom: 16 }}>{message}</div>
        {onAction && (
          <button
            onClick={onAction}
            style={{
              background: "rgba(255,255,255,0.1)",
              color: "#f1f1f5",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10,
              padding: "10px 22px",
              cursor: "pointer",
            }}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          color: "#6b6b7a",
          textTransform: "uppercase",
          letterSpacing: ".5px",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function TicketList({ tickets, type }) {
  if (tickets.length === 0)
    return (
      <p style={A.empty}>
        {type === "paid"
          ? "No paid tickets yet."
          : type === "scanned"
            ? "No check-ins yet."
            : "No confirmed tickets waiting to scan."}
      </p>
    );
  return (
    <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
      {tickets.map((ticket) => (
        <div key={ticket.id} style={A.ticketRow}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={A.ticketName}>{ticket.attendeeName}</div>
            <div style={A.ticketEmail}>{ticket.attendeeEmail}</div>
            {type === "scanned" && ticket.checkedInAt && (
              <div style={A.ticketTime}>
                {new Intl.DateTimeFormat("en-NG", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                }).format(new Date(ticket.checkedInAt))}
              </div>
            )}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 5,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                ...A.chip,
                ...(type === "unscanned" ? A.chipOff : A.chipOn),
              }}
            >
              {type === "paid"
                ? "Paid"
                : type === "scanned"
                  ? "✓ Scanned"
                  : "⏳ Pending"}
            </span>
            <span style={A.ticketAmount}>
              ₦
              {Number(
                (ticket.amountPaid ?? ticket.price) || 0,
              ).toLocaleString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── styles ─── */
const A = {
  page: {
    minHeight: "100vh",
    background: "#0c0c10",
    color: "#f0f0f4",
    fontFamily: "'DM Sans',system-ui,sans-serif",
    WebkitFontSmoothing: "antialiased",
  },
  topbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
    padding: "20px 28px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(12,12,16,0.9)",
    position: "sticky",
    top: 0,
    zIndex: 100,
    backdropFilter: "blur(18px)",
  },
  kicker: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "1.5px",
    color: "#a78bfa",
    marginBottom: 4,
  },
  pageTitle: {
    margin: 0,
    fontSize: "clamp(22px,3.5vw,36px)",
    fontWeight: 900,
    letterSpacing: "-.04em",
    color: "#f0f0f4",
  },

  main: { maxWidth: 1280, margin: "0 auto", padding: "28px 24px 80px" },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    padding: "18px 16px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
  },
  statLabel: {
    fontSize: 12,
    color: "#6b6b7a",
    marginBottom: 8,
    fontWeight: 600,
  },
  statValue: {
    fontSize: 30,
    fontWeight: 900,
    letterSpacing: "-.04em",
    lineHeight: 1,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))",
    gap: 16,
    alignItems: "start",
  },
  panel: {
    padding: 22,
    borderRadius: 20,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
  },
  panelWide: {
    gridColumn: "1 / -1",
    padding: 22,
    borderRadius: 20,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
  },
  panelHead: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 16,
    fontWeight: 800,
    marginBottom: 16,
    color: "#f0f0f4",
  },
  panelIcon: { fontSize: 18 },
  countBadge: {
    marginLeft: "auto",
    fontSize: 12,
    fontWeight: 700,
    background: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    padding: "2px 10px",
    color: "#9ca3af",
  },
  coHostBadge: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: 800,
    background: "#fef3c7",
    color: "#92400e",
    borderRadius: 8,
    padding: "6px 10px",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    background: "rgba(0,0,0,0.3)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    color: "#f0f0f4",
    padding: "11px 14px",
    fontFamily: "'DM Sans',system-ui,sans-serif",
    fontSize: 14,
    outline: "none",
  },
  textarea: { resize: "vertical" },
  helperText: { fontSize: 12, color: "#6b6b7a", margin: "-8px 0 0" },

  nomineeCard: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 14,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
  },

  primaryBtn: {
    width: "100%",
    background: "#f0f0f4",
    color: "#111",
    border: "none",
    borderRadius: 12,
    padding: "13px 0",
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "'DM Sans',system-ui,sans-serif",
  },
  accentBtn: {
    background: "#a78bfa",
    color: "#1a0533",
    border: "none",
    borderRadius: 999,
    padding: "9px 18px",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "'DM Sans',system-ui,sans-serif",
  },
  ghostBtn: {
    background: "rgba(255,255,255,0.07)",
    color: "#f0f0f4",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 999,
    padding: "9px 18px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "'DM Sans',system-ui,sans-serif",
  },
  ghostSmBtn: {
    background: "rgba(255,255,255,0.06)",
    color: "#b0b0c0",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    padding: "7px 12px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "'DM Sans',system-ui,sans-serif",
  },
  addNomineeBtn: {
    background: "rgba(167,139,250,0.1)",
    color: "#c4b5fd",
    border: "1px dashed rgba(167,139,250,0.3)",
    borderRadius: 10,
    padding: "11px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "'DM Sans',system-ui,sans-serif",
  },
  dangerBtn: {
    background: "rgba(248,113,113,0.1)",
    color: "#fca5a5",
    border: "1px solid rgba(248,113,113,0.25)",
    borderRadius: 10,
    padding: "9px 16px",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "'DM Sans',system-ui,sans-serif",
    flexShrink: 0,
    whiteSpace: "nowrap",
  },
  dangerSmBtn: {
    background: "rgba(248,113,113,0.08)",
    color: "#fca5a5",
    border: "1px solid rgba(248,113,113,0.2)",
    borderRadius: 8,
    padding: "7px 12px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "'DM Sans',system-ui,sans-serif",
  },

  successBanner: {
    padding: "12px 14px",
    borderRadius: 12,
    background: "rgba(74,222,128,0.1)",
    color: "#86efac",
    marginBottom: 14,
    fontWeight: 700,
    fontSize: 14,
    border: "1px solid rgba(74,222,128,0.2)",
  },
  errorBanner: {
    padding: "12px 14px",
    borderRadius: 12,
    background: "rgba(248,113,113,0.1)",
    color: "#fca5a5",
    marginBottom: 14,
    fontWeight: 700,
    fontSize: 14,
    border: "1px solid rgba(248,113,113,0.2)",
  },

  ticketRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    padding: "12px 14px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  ticketName: {
    fontSize: 14,
    fontWeight: 700,
    color: "#f0f0f4",
    marginBottom: 2,
  },
  ticketEmail: { fontSize: 12, color: "#6b6b7a" },
  ticketTime: { fontSize: 11, color: "#4ade80", marginTop: 3 },
  ticketAmount: { fontSize: 13, fontWeight: 700, color: "#ddd6fe" },
  chip: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
  },
  chipOn: { background: "rgba(74,222,128,0.12)", color: "#86efac" },
  chipOff: { background: "rgba(248,113,113,0.1)", color: "#fca5a5" },
  empty: { color: "#6b6b7a", fontSize: 14, padding: "8px 0" },

  /* award card */
  awardCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    overflow: "hidden",
  },
  awardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    padding: "18px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.02)",
    flexWrap: "wrap",
  },
  awardTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: "#f0f0f4",
    marginBottom: 4,
  },
  awardDesc: { fontSize: 13, color: "#9ca3af", marginBottom: 6 },
  awardMeta: { fontSize: 12, color: "#6b6b7a", fontWeight: 600 },

  /* nominee leaderboard */
  nomineeLeaderboard: { padding: "16px 20px", display: "grid", gap: 10 },
  nomineeRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.05)",
    transition: "border-color .2s",
  },
  nomineeRowLeader: {
    background: "rgba(167,139,250,0.07)",
    border: "1px solid rgba(167,139,250,0.2)",
  },
  rankBadge: {
    fontSize: 11,
    fontWeight: 800,
    color: "#6b6b7a",
    background: "rgba(255,255,255,0.07)",
    borderRadius: 6,
    padding: "3px 8px",
    flexShrink: 0,
    minWidth: 32,
    textAlign: "center",
  },
  nomineeAvatar: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    objectFit: "cover",
    flexShrink: 0,
  },
  nomineeAvatarFb: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "rgba(167,139,250,0.15)",
    color: "#c4b5fd",
    display: "grid",
    placeItems: "center",
    fontWeight: 800,
    fontSize: 15,
    flexShrink: 0,
  },
  nomineeName: {
    fontSize: 14,
    fontWeight: 700,
    color: "#f0f0f4",
    marginBottom: 6,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  leaderTag: {
    fontSize: 11,
    fontWeight: 700,
    color: "#a78bfa",
    background: "rgba(167,139,250,0.12)",
    borderRadius: 999,
    padding: "2px 8px",
  },
  barTrack: {
    height: 5,
    background: "rgba(255,255,255,0.07)",
    borderRadius: 999,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
    transition: "width .6s ease",
    minWidth: 4,
  },
  nomineeVotes: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 2,
    flexShrink: 0,
    minWidth: 56,
  },
  voteCount: {
    fontSize: 20,
    fontWeight: 900,
    letterSpacing: "-.5px",
    color: "#f0f0f4",
    lineHeight: 1,
  },
  votePct: { fontSize: 11, color: "#6b6b7a", fontWeight: 600 },

  nomineeGroup: {
    padding: 16,
    borderRadius: 14,
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  nomineeGroupTitle: {
    fontSize: 15,
    fontWeight: 800,
    marginBottom: 12,
    color: "#f0f0f4",
  },
  nomineeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))",
    gap: 12,
  },
  nomineeCardLg: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  nomineeActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    justifyContent: "space-between",
  },
  nomineeAvatarLg: {
    width: 48,
    height: 48,
    borderRadius: "50%",
    objectFit: "cover",
    flexShrink: 0,
  },
  nomineeAvatarFbLg: {
    width: 48,
    height: 48,
    borderRadius: "50%",
    background: "rgba(167,139,250,0.15)",
    color: "#c4b5fd",
    display: "grid",
    placeItems: "center",
    fontWeight: 800,
    fontSize: 16,
    flexShrink: 0,
  },
  nomineeNameLg: {
    fontSize: 14,
    fontWeight: 800,
    color: "#f0f0f4",
    marginBottom: 4,
  },
  nomineeMeta: { fontSize: 12, color: "#9ca3af" },
  nomineeLock: { fontSize: 11, color: "#fca5a5", fontWeight: 700 },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(5,5,8,0.7)",
    display: "grid",
    placeItems: "center",
    padding: 16,
    zIndex: 120,
  },
  modalCard: {
    width: "min(680px, 100%)",
    background: "#101018",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    padding: 20,
    boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
  },
  modalHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: 800, color: "#f0f0f4" },
  modalSub: { fontSize: 12, color: "#9ca3af" },
  modalBody: { display: "grid", gap: 12 },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
  },

  recentVotes: {
    padding: "12px 20px 16px",
    borderTop: "1px solid rgba(255,255,255,0.05)",
  },
  recentVotesLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: ".5px",
    color: "#6b6b7a",
    marginBottom: 8,
  },
  voteChip: {
    padding: "6px 12px",
    borderRadius: 999,
    background: "rgba(167,139,250,0.1)",
    color: "#ddd6fe",
    fontSize: 12,
    fontWeight: 600,
    border: "1px solid rgba(167,139,250,0.15)",
  },
};
