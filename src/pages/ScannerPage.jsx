import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { BrowserQRCodeReader } from '@zxing/browser'
import BackButton from '../components/BackButton.jsx'
import { apiRequest } from '../services/api.js'

export default function ScannerPage() {
  const { eventId } = useParams()
  const videoRef = useRef(null)
  const readerRef = useRef(null)
  const controlsRef = useRef(null)
  const lastScanRef = useRef('')
  const verifyingRef = useRef(false)

  const [status, setStatus] = useState('')
  const [scanning, setScanning] = useState(false)
  const [stats, setStats] = useState(null)
  const [manual, setManual] = useState('')
  const [devices, setDevices] = useState([])
  const [activeDeviceId, setActiveDeviceId] = useState('')
  const [cameraError, setCameraError] = useState('')

  const canUseCamera = useMemo(() => {
    if (typeof window === 'undefined') return false
    if (!navigator.mediaDevices?.getUserMedia) return false
    if (window.isSecureContext) return true
    return window.location.hostname === 'localhost'
  }, [])

  useEffect(() => {
    fetchStats()
    // eslint-disable-next-line
  }, [eventId])

  async function fetchStats() {
    try {
      const payload = await apiRequest(`/tickets/events/${eventId}`)
      setStats(payload.data)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function initCamera() {
      if (!canUseCamera) {
        setCameraError('Camera access requires HTTPS (or localhost) and browser permission.')
        setStatus('Camera unavailable. Use manual input.')
        return
      }

      try {
        readerRef.current = new BrowserQRCodeReader()
        const foundDevices = await BrowserQRCodeReader.listVideoInputDevices()
        if (cancelled) return

        if (!foundDevices.length) {
          setCameraError('No camera found on this device.')
          setStatus('No camera found. Use manual input.')
          return
        }

        setDevices(foundDevices)
        const preferred = pickDefaultDevice(foundDevices)
        setActiveDeviceId(preferred?.deviceId || foundDevices[0].deviceId)
      } catch (err) {
        if (cancelled) return
        setCameraError(getCameraErrorMessage(err))
        setStatus('Camera error. Use manual input.')
      }
    }

    initCamera()

    return () => {
      cancelled = true
      controlsRef.current?.stop()
      readerRef.current?.reset?.()
    }
  }, [canUseCamera, eventId])

  useEffect(() => {
    let cancelled = false

    async function startScanning() {
      if (!activeDeviceId || !readerRef.current || !videoRef.current) return

      try {
        controlsRef.current?.stop()
        setCameraError('')
        setStatus('Scanner ready')

        const controls = await readerRef.current.decodeFromVideoDevice(
          activeDeviceId,
          videoRef.current,
          (result) => {
            if (!result) return
            if (cancelled) return
            handleScanned(result.getText())
          }
        )

        controlsRef.current = controls
        setScanning(true)
      } catch (err) {
        if (cancelled) return
        setCameraError(getCameraErrorMessage(err))
        setStatus('Camera error. Use manual input.')
        setScanning(false)
      }
    }

    startScanning()
    return () => {
      cancelled = true
      controlsRef.current?.stop()
    }
  }, [activeDeviceId])

  async function handleScanned(raw) {
    if (!raw || verifyingRef.current) return
    if (raw === lastScanRef.current) return
    lastScanRef.current = raw
    const ticketReference = extractTicketReference(raw)
    if (!ticketReference) {
      setStatus('Could not parse a ticket reference from the QR code.')
      return
    }
    await verifyTicket(ticketReference)
  }

  function extractTicketReference(raw) {
    try {
      const url = new URL(raw)
      const reference = url.searchParams.get('ticketReference') || url.searchParams.get('ticketId')
      if (reference) return reference

      const parts = url.pathname.split('/')
      const idx = parts.indexOf('tickets')
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1]
    } catch (_) {}

    if (/^[A-Za-z0-9\-]{6,}$/.test(raw)) return raw
    return null
  }

  async function verifyTicket(ticketReference) {
    if (!ticketReference || verifyingRef.current) return
    verifyingRef.current = true
    try {
      setStatus('Verifying ticket...')
      const payload = await apiRequest('/tickets/verify', {
        method: 'POST',
        body: JSON.stringify({ ticketReference }),
      })
      setStatus(`Check-in successful: ${payload.message || 'OK'}`)
      fetchStats()
    } catch (err) {
      console.error(err)
      setStatus(err.message || 'Verification error')
    } finally {
      verifyingRef.current = false
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <BackButton fallback="/" />
        <header style={styles.header}>
          <div>
            <h2 style={styles.title}>Event Check-in</h2>
            <p style={styles.subTitle}>Scan QR codes or paste a ticket reference to check guests in at the door.</p>
          </div>
          <div style={styles.cameraState}>{scanning ? 'Scanning active' : 'Camera ready'}</div>
        </header>

        {stats && stats.event && (
          <section style={styles.statsBar}>
            <div style={styles.statsTitle}>{stats.event.title}</div>
            <div style={styles.statsGrid}>
              <div style={styles.statCard}><span>Paid</span><strong>{stats.paidCount}</strong></div>
              <div style={styles.statCard}><span>Checked-in</span><strong>{stats.scannedCount}</strong></div>
              <div style={styles.statCard}><span>To enter</span><strong>{stats.unscannedCount}</strong></div>
            </div>
          </section>
        )}

        <div style={styles.layout}>
          <section style={styles.cameraPanel}>
            <video ref={videoRef} autoPlay playsInline muted style={styles.video} />
            <div style={styles.cameraHint}>Align the QR code inside the frame.</div>
            {devices.length > 1 && (
              <div style={styles.cameraSwitchRow}>
                <label style={styles.panelLabel}>Camera</label>
                <select
                  value={activeDeviceId}
                  onChange={(e) => setActiveDeviceId(e.target.value)}
                  style={styles.cameraSelect}
                >
                  {devices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camera ${device.deviceId.slice(0, 4)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {cameraError && <div style={styles.cameraError}>{cameraError}</div>}
          </section>

          <aside style={styles.sidePanel}>
            <div>
              <div style={styles.panelLabel}>Status</div>
              <div style={styles.statusBox}>{status || 'Idle'}</div>
            </div>

            <div style={styles.manualBox}>
              <div style={styles.panelLabel}>Manual check-in</div>
              <input
                value={manual}
                onChange={e => setManual(e.target.value)}
                placeholder="Paste ticket URL or reference"
                style={styles.manualInput}
              />
              <button onClick={() => verifyTicket(manual)} style={styles.verifyBtn}>
                Verify ticket
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

function pickDefaultDevice(devices) {
  return devices.find(device => /back|rear|environment/i.test(device.label)) || devices[0]
}

function getCameraErrorMessage(error) {
  const name = String(error?.name || '')
  if (name === 'NotAllowedError') return 'Camera permission denied. Please allow access and refresh.'
  if (name === 'NotFoundError') return 'No camera found on this device.'
  if (name === 'NotReadableError') return 'Camera is already in use by another application.'
  if (name === 'NotSupportedError') return 'Camera is not supported in this browser.'
  return 'Unable to start the camera. Use manual input instead.'
}

const styles = {
  page: {
    minHeight: '100vh',
    padding: 'clamp(14px, 3vw, 24px)',
    background: 'radial-gradient(circle at top, rgba(167,139,250,0.12), transparent 30%), #0b0b10',
    color: '#f3f4f6',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  shell: {
    maxWidth: 1400,
    margin: '0 auto',
    display: 'grid',
    gap: 20,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  title: { margin: 0, fontSize: 'clamp(28px, 4vw, 48px)', letterSpacing: '-0.04em' },
  subTitle: { margin: '8px 0 0', color: '#a1a1aa', fontSize: 14 },
  cameraState: {
    padding: '10px 14px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#e5e7eb',
    fontWeight: 700,
  },
  statsBar: {
    padding: 18,
    borderRadius: 20,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  statsTitle: { fontSize: 18, fontWeight: 800, marginBottom: 12 },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
    gap: 12,
  },
  statCard: {
    padding: 14,
    borderRadius: 16,
    background: 'rgba(0,0,0,0.24)',
    border: '1px solid rgba(255,255,255,0.06)',
    display: 'grid',
    gap: 6,
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
    gap: 20,
    alignItems: 'start',
  },
  cameraPanel: {
    padding: 16,
    borderRadius: 24,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  video: {
    width: '100%',
    aspectRatio: '16 / 10',
    minHeight: 'min(56vw, 560px)',
    borderRadius: 18,
    background: '#000',
    objectFit: 'cover',
  },
  cameraHint: { marginTop: 12, color: '#a1a1aa', fontSize: 14 },
  cameraSwitchRow: {
    display: 'grid',
    gap: 8,
    marginTop: 12,
  },
  cameraSelect: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(0,0,0,0.25)',
    color: '#f3f4f6',
    fontSize: 13,
  },
  cameraError: {
    marginTop: 12,
    padding: '10px 12px',
    borderRadius: 12,
    background: 'rgba(248,113,113,0.12)',
    border: '1px solid rgba(248,113,113,0.2)',
    color: '#fca5a5',
    fontSize: 13,
    fontWeight: 600,
  },
  sidePanel: {
    display: 'grid',
    gap: 16,
    padding: 16,
    borderRadius: 24,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  panelLabel: { fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 8 },
  statusBox: {
    minHeight: 120,
    padding: 16,
    borderRadius: 18,
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.06)',
    color: '#f3f4f6',
    fontSize: 15,
    lineHeight: 1.5,
  },
  manualBox: {
    display: 'grid',
    gap: 10,
    padding: 16,
    borderRadius: 18,
    background: 'rgba(0,0,0,0.24)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  manualInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#f3f4f6',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    outline: 'none',
  },
  verifyBtn: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: 'none',
    background: '#f3f4f6',
    color: '#0b0b10',
    fontWeight: 800,
    cursor: 'pointer',
  },
}
