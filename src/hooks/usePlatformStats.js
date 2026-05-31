import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../services/api.js'

export function usePlatformStats() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    async function loadStats() {
      setLoading(true)
      setError('')

      try {
        const payload = await apiRequest('/system/stats')
        if (!mountedRef.current) return
        setStats(payload.data || null)
      } catch (err) {
        if (!mountedRef.current) return
        setError(err.message || 'Failed to load stats')
      } finally {
        if (!mountedRef.current) return
        setLoading(false)
      }
    }

    loadStats()
    return () => {
      mountedRef.current = false
    }
  }, [])

  return { stats, loading, error }
}
