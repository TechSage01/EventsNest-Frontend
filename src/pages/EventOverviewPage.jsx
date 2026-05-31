import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BackButton from '../components/BackButton.jsx'
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
  const { logout } = useAuth()

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
  const isOwner = Boolean(event && String(event.createdByAdminId || event.organizerId || '') === String(user?.userId || ''))

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
      description: event.description || '',
      votingRules: event.votingRules || '',
      status: event.status || 'active',
      ticketVipPrice: event?.ticketPrices?.vip ?? '',
      ticketTablePrice: event?.ticketPrices?.table ?? '',
    })
  }, [event])

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
    if (!isOwner) {
      setError('You are not authorized to edit this event')
      return
    }
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
      if (!res.ok) {
        const message = res.status === 403
          ? 'You are not authorized to edit this event'
          : (payload.message || 'Update failed')
        throw new Error(message)
      }
      setEvent(payload.data?.event); setEditing(false); showToast('Event saved.')
    } catch (err) { setError(err.message) }
    finally       { setSavingEvent(false) }
  }

  async function handleToggleVisibility() {
    if (!isOwner) {
      setError('You are not authorized to edit this event')
      return
    }
    setSavingVis(true)
    try {
      const token = localStorage.getItem('es_token')
      const res = await fetch(`${API_BASE}/events/${eventId}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body: JSON.stringify({ isPublic: !event.isPublic }),
      })
      const payload = await res.json()
      if (!res.ok) {
        const message = res.status === 403
          ? 'You are not authorized to edit this event'
          : (payload.message || 'Update failed')
        throw new Error(message)
      }
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
      setEvent(payload.data?.event); setHostForm({ name:'', email:'', role:'Co-host' })
      const sent = Boolean(payload.data?.emailSent)
      showToast(sent ? 'Host added — invitation email sent.' : 'Host added — invitation failed to send.')
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

  async function handleOneClickRsvp() {
    if (!user?.name || !user?.email) {
      showToast('Your profile name and email are needed to RSVP.')
      return
    }

    try {
      const res = await fetch(`${API_BASE}/events/public/${eventId}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: user.name, email: user.email, note: '' }),
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
      showToast('RSVP confirmed.')
    } catch (err) {
      showToast(err.message)
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
          <BackButton fallback="/" style={isSmallMobile ? s.backBtnCompact : {}} />
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
            <Btn onClick={() => setEditing(v=>!v)} disabled={!isOwner} style={{flex: isMobile ? 1 : 'unset'}}>
              {editing ? 'Close' : 'Edit Event'}
            </Btn>
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
                  Welcome, <strong>{user?.name || event.hostName || 'Creator'}</strong>! To join the event, please register below.
                </p>
                <div style={s.regHostRow}>
                  <div style={s.regHostAvatar}>{initials(event.hostName || user?.name)}</div>
                  <div>
                    <div style={s.regHostName}>{event.hostName || user?.name || 'Creator'}</div>
                    <div style={s.regHostEmail}>{event.hostEmail || user?.email || ''}</div>
                  </div>
                </div>
                <button type="button" style={s.rsvpBtn} onClick={handleOneClickRsvp}>One-Click RSVP</button>
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
                <button style={{...s.bottomBtn, flex: isMobile ? 1 : 'unset', opacity: !isOwner ? 0.5 : 1}} onClick={() => isOwner && setEditing(v=>!v)}>
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
                    <span style={s.editLabel}>Description</span>
                    <textarea
                      value={editForm.description}
                      onChange={e => setEditForm(p=>({...p,description:e.target.value}))}
                      style={s.editTextarea}
                      rows={3}
                    />
                  </label>
                  <label style={{ ...s.editField, gridColumn: '1/-1' }}>
                    <span style={s.editLabel}>Voting Rules</span>
                    <textarea
                      value={editForm.votingRules}
                      onChange={e => setEditForm(p=>({...p,votingRules:e.target.value}))}
                      style={s.editTextarea}
                      rows={3}
                      placeholder="Optional rules for voters"
                    />
                  </label>
                  <label style={s.editField}>
                    <span style={s.editLabel}>Status</span>
                    <select
                      value={editForm.status}
                      onChange={e => setEditForm(p=>({...p,status:e.target.value}))}
                      style={s.editSelect}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
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
                  <Btn onClick={handleToggleVisibility} disabled={savingVis || !isOwner} style={{width: isSmallMobile ? '100%' : 'auto'}}>
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
                <button style={{...s.sideVisBtn, opacity: !isOwner ? 0.5 : 1}} onClick={handleToggleVisibility} disabled={savingVis || !isOwner}>
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
        <BackButton fallback="/" style={s.shellBackButton} />
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
        <BackButton fallback="/" style={s.shellBackButton} />
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
  backBtnCompact: { padding: '9px 10px', minWidth: 40 },
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
  rsvpBtn:     { width:'100%', padding:'12px', borderRadius:12, background:'#f0f0f4', color:'#111114', border:'none', fontWeight:700, fontSize:14, cursor:'pointer', transition:'opacity .15s' },

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
  editTextarea:{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:13.5, fontFamily:'inherit', resize:'vertical' },
  editSelect:  { background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:13.5, fontFamily:'inherit' },
  fileInput:   { fontSize:13, color:'#7a7a8a' },
  editFooter:  { display:'flex', justifyContent:'flex-end', gap:10, marginTop:10 }
  , inputError: { color: '#fca5a5', marginTop: 6, fontSize: 13, fontWeight: 700 }
}
