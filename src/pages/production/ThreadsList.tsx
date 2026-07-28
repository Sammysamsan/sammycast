import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { daysLeft, fetchThreads, type Thread } from '../../lib/api'

export function ThreadsList() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchThreads({ mine: true })
      .then(setThreads)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load threads'))
  }, [])

  return (
    <main className="rise">
      <div className="page-head">
        <div>
          <p className="kicker">Casting calls</p>
          <h1 className="h1">Audition threads</h1>
          <p className="lead">Active roles, deadlines, and reply volume — open Review to shortlist.</p>
        </div>
        <Link className="btn btn-primary" style={{ width: 'auto' }} to="/production/threads/new">
          New thread
        </Link>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="bento">
        {threads.map((t, i) => (
          <Link key={t.id} className={`bento-tile ${i === 0 ? 'bento-wide' : ''}`} to={`/production/review?thread=${t.id}`}>
            <p className="kicker">{t.status} · {t.visibilityDefault}</p>
            <h3 className="h2">{t.roleTitle}</h3>
            <p className="muted clamp-2">{t.characterBrief}</p>
            <div className="chip-row" style={{ marginTop: 12 }}>
              <span className="chip">{t.language}</span>
              <span className="chip">{daysLeft(t.deadline)}</span>
              <span className="chip">{t.replyCount || 0} replies</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}
