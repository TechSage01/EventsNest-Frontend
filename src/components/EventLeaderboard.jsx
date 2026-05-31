import React from 'react'

function formatVotes(value) {
  return Number(value || 0).toLocaleString()
}

export default function EventLeaderboard({
  entries,
  loading,
  error,
  totalVotes,
  lastUpdated,
}) {
  const hasEntries = Array.isArray(entries) && entries.length > 0

  return (
    <section style={styles.card}>
      <div style={styles.header}>
        <div>
          <div style={styles.kicker}>Live Leaderboard</div>
          <div style={styles.title}>Top Nominees</div>
        </div>
        <div style={styles.meta}>
          {loading && !hasEntries ? (
            <span style={styles.loadingBadge} aria-label="Loading leaderboard">Loading</span>
          ) : (
            <span style={styles.updatedText}>
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}` : 'Auto-updating'}
            </span>
          )}
        </div>
      </div>

      {error && !hasEntries && (
        <div style={styles.error}>{error}</div>
      )}

      {loading && !hasEntries ? (
        <div style={styles.loading}>Loading leaderboard...</div>
      ) : hasEntries ? (
        <div style={styles.list}>
          {entries
            .slice()
            .sort((a, b) => Number(b.votes || 0) - Number(a.votes || 0))
            .map((entry, index) => {
              const pct = totalVotes > 0 ? Math.round((Number(entry.votes || 0) / totalVotes) * 100) : 0
              const isLeader = index === 0 && Number(entry.votes || 0) > 0

              return (
                <div key={entry.id || `${entry.name}-${index}`} style={{
                  ...styles.row,
                  ...(isLeader ? styles.rowLeader : null),
                }}>
                  <div style={{ ...styles.rank, ...(index < 3 ? styles.topRank : null) }}>#{index + 1}</div>
                  {entry.imageUrl ? (
                    <img src={entry.imageUrl} alt={entry.name} style={styles.avatar} />
                  ) : (
                    <div style={styles.avatarFallback}>{String(entry.name || '?').charAt(0).toUpperCase()}</div>
                  )}
                  <div style={styles.body}>
                    <div style={styles.nameRow}>
                      <span style={styles.name}>{entry.name}</span>
                      {isLeader && <span style={styles.leader}>Leading</span>}
                    </div>
                    <div style={styles.barTrack}>
                      <div style={{ ...styles.barFill, width: `${pct}%` }} />
                    </div>
                  </div>
                  <div style={styles.votesCol}>
                    <span style={{ ...styles.voteCount, ...(isLeader ? styles.voteCountLeader : null) }}>
                      {formatVotes(entry.votes)}
                    </span>
                    <span style={styles.votePct}>{pct}%</span>
                  </div>
                </div>
              )
            })}
        </div>
      ) : (
        <div style={styles.empty}>No votes yet. Be the first to vote.</div>
      )}
    </section>
  )
}

const styles = {
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  kicker: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.12em',
    color: '#6b6b7a',
  },
  title: {
    fontSize: 18,
    fontWeight: 800,
    color: '#f1f1f5',
  },
  meta: { display: 'flex', alignItems: 'center', gap: 8 },
  updatedText: { fontSize: 12, color: '#9ca3af', fontWeight: 600 },
  loadingBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: '4px 8px',
    borderRadius: 999,
    border: '1px solid rgba(167,139,250,0.25)',
    color: '#c4b5fd',
    background: 'rgba(167,139,250,0.12)',
  },
  error: {
    padding: '10px 12px',
    borderRadius: 12,
    background: 'rgba(248,113,113,0.1)',
    border: '1px solid rgba(248,113,113,0.2)',
    color: '#fca5a5',
    fontWeight: 600,
  },
  loading: { color: '#9ca3af', fontSize: 13 },
  empty: { color: '#9ca3af', fontSize: 13 },
  list: { display: 'grid', gap: 10 },
  row: {
    display: 'grid',
    gridTemplateColumns: 'auto auto 1fr auto',
    gap: 10,
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  rowLeader: {
    borderColor: 'rgba(167,139,250,0.4)',
    background: 'rgba(167,139,250,0.1)',
  },
  rank: {
    fontSize: 12,
    fontWeight: 700,
    color: '#9ca3af',
    minWidth: 34,
  },
  topRank: {
    color: '#c4b5fd',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    objectFit: 'cover',
  },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    background: 'rgba(167,139,250,0.15)',
    color: '#c4b5fd',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 800,
  },
  body: { display: 'grid', gap: 6 },
  nameRow: { display: 'flex', alignItems: 'center', gap: 8 },
  name: { fontSize: 14, fontWeight: 700, color: '#f1f1f5' },
  leader: {
    fontSize: 10,
    fontWeight: 700,
    color: '#a78bfa',
    textTransform: 'uppercase',
    letterSpacing: '.1em',
  },
  barTrack: {
    width: '100%',
    height: 6,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    background: '#a78bfa',
  },
  votesCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 2,
  },
  voteCount: { fontSize: 16, fontWeight: 800, color: '#f1f1f5' },
  voteCountLeader: { color: '#c4b5fd' },
  votePct: { fontSize: 11, color: '#9ca3af', fontWeight: 700 },
}
