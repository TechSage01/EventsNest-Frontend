import { useNavigate } from 'react-router-dom'

export default function BackButton({ label = 'Back', fallback = '/', style = {} }) {
  const navigate = useNavigate()

  function handleBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1)
      return
    }

    navigate(fallback, { replace: true })
  }

  return (
    <button type="button" onClick={handleBack} style={{ ...styles.button, ...style }} aria-label={label}>
      <span style={styles.icon} aria-hidden="true">‹</span>
      <span>{label}</span>
    </button>
  )
}

const styles = {
  button: {
    minHeight: 40,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: '9px 14px',
    background: 'rgba(255,255,255,0.06)',
    color: '#f4f4f5',
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
  },
  icon: {
    fontSize: 24,
    lineHeight: 0.8,
    transform: 'translateY(-1px)',
  },
}
