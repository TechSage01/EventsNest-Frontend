import { useEffect, useRef, useState } from 'react'
import EventLeaderboard from './EventLeaderboard.jsx'
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

export default function AdminLeaderboard({ eventId }) {
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [totalVotes, setTotalVotes] = useState(0)
  const [lastUpdated, setLastUpdated] = useState(null)
  const isMounted = useRef(true)
  const hasEntriesRef = useRef(false)

  useEffect(() => {
    isMounted.current = true
    if (!eventId) {
      setLeaderboard([])
      setLoading(false)
      return () => { isMounted.current = false }
    }

    const fetchLeaderboard = async (isInitial = false) => {
      if (isInitial) {
        setLoading(true)
      }

      try {
        const payload = await apiRequest(`/events/${eventId}/leaderboard`)
        const entries = normalizeLeaderboardEntries(extractLeaderboardEntries(payload))
        if (!isMounted.current) return
        setLeaderboard(entries)
        setTotalVotes(entries.reduce((sum, item) => sum + Number(item.votes || 0), 0))
        setLastUpdated(new Date())
        setError('')
        hasEntriesRef.current = entries.length > 0
      } catch (err) {
        if (!isMounted.current) return
        if (!hasEntriesRef.current && isInitial) {
          setError(err.message || 'Failed to load leaderboard')
        }
      } finally {
        if (!isMounted.current) return
        if (isInitial) {
          setLoading(false)
        }
      }
    }

    fetchLeaderboard(true)
    const timer = setInterval(() => {
      fetchLeaderboard(false)
    }, 20000)

    return () => {
      isMounted.current = false
      clearInterval(timer)
    }
  }, [eventId])

  return (
    <section style={styles.panel}>
      <div style={styles.header}>
        <div style={styles.title}>Private Leaderboard</div>
        <div style={styles.subTitle}>Auto-refreshing every 20 seconds</div>
      </div>
      <EventLeaderboard
        entries={leaderboard}
        loading={loading}
        error={error}
        totalVotes={totalVotes}
        lastUpdated={lastUpdated}
      />
    </section>
  )
}

const styles = {
  panel: {
    display: 'grid',
    gap: 12,
  },
  header: {
    display: 'grid',
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: 800,
    color: '#f8fafc',
  },
  subTitle: {
    fontSize: 12,
    color: '#94a3b8',
  },
}
