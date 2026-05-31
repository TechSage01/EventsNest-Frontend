import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiRequest } from '../services/api.js'

function normalizeLeaderboardEntries(rawEntries) {
  if (!Array.isArray(rawEntries)) return []

  return rawEntries.map((entry, index) => {
    const nominee = entry?.nominee || entry?.contestant || entry?.candidate || {}
    const id = entry?.id || entry?._id || entry?.nomineeId || entry?.contestantId || nominee?.id || nominee?._id || ''
    const name = entry?.name || entry?.nomineeName || nominee?.name || entry?.nominee || entry?.title || `Nominee ${index + 1}`
    const votes = Number(entry?.votes ?? entry?.voteCount ?? entry?.totalVotes ?? entry?.count ?? entry?.total ?? 0)
    const imageUrl = entry?.imageUrl || entry?.image || entry?.photo || nominee?.imageUrl || nominee?.image || ''

    return {
      id,
      name,
      votes,
      imageUrl,
    }
  })
}

function extractLeaderboardEntries(payload) {
  return payload?.data?.leaderboard
    || payload?.leaderboard
    || payload?.data?.nominees
    || payload?.nominees
    || payload?.data?.contestants
    || payload?.contestants
    || []
}

export function useEventLeaderboard(eventId, options = {}) {
  const intervalMs = options.intervalMs ?? 20000
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const isMounted = useRef(true)

  const fetchLeaderboard = useCallback(async (isInitial) => {
    if (!eventId) return

    if (isInitial) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }

    try {
      const payload = await apiRequest(`/events/${eventId}/leaderboard`)
      const entries = normalizeLeaderboardEntries(extractLeaderboardEntries(payload))
      if (!isMounted.current) return
      setLeaderboard(entries)
      setError('')
      setLastUpdated(new Date())
    } catch (err) {
      if (!isMounted.current) return
      setError(err.message || 'Failed to load leaderboard')
    } finally {
      if (!isMounted.current) return
      setLoading(false)
      setRefreshing(false)
    }
  }, [eventId])

  useEffect(() => {
    isMounted.current = true
    if (!eventId) {
      setLeaderboard([])
      setLoading(false)
      return () => { isMounted.current = false }
    }

    fetchLeaderboard(true)

    const timer = setInterval(() => {
      fetchLeaderboard(false)
    }, intervalMs)

    return () => {
      isMounted.current = false
      clearInterval(timer)
    }
  }, [eventId, fetchLeaderboard, intervalMs])

  const totalVotes = useMemo(() => leaderboard.reduce((sum, item) => sum + Number(item.votes || 0), 0), [leaderboard])

  return {
    leaderboard,
    loading,
    refreshing,
    error,
    totalVotes,
    lastUpdated,
    refresh: () => fetchLeaderboard(false),
  }
}
