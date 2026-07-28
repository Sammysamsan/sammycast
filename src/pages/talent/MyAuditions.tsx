import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchMySubmissions, type Submission } from '../../lib/api'

type StatusFilter = 'All' | 'complete' | 'processing' | 'queued' | 'error'

function statusBucket(status: string): StatusFilter {
  if (status === 'complete') return 'complete'
  if (status === 'error') return 'error'
  if (status === 'queued') return 'queued'
  return 'processing'
}

export function MyAuditions() {
  const [subs, setSubs] = useState<Submission[]>([])
  const [status, setStatus] = useState<StatusFilter>('All')

  useEffect(() => {
    fetchMySubmissions().then(setSubs)
  }, [])

  const filtered = useMemo(() => {
    if (status === 'All') return subs
    return subs.filter((s) => statusBucket(s.status) === status)
  }, [subs, status])

  const insights = useMemo(() => {
    const complete = subs.filter((s) => s.status === 'complete')
    const pending = subs.filter((s) => s.status !== 'complete' && s.status !== 'error')
    const scores = complete.map((s) => s.overall).filter((n): n is number => typeof n === 'number')
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
    const best = scores.length ? Math.max(...scores) : null
    const publicCount = subs.filter((s) => s.visibility === 'public').length
    return {
      total: subs.length,
      complete: complete.length,
      pending: pending.length,
      avg,
      best,
      publicCount,
    }
  }, [subs])

  return (
    <main className="rise">
      <div className="page-head">
        <div>
          <p className="kicker">Auditions</p>
          <h1 className="h1">My takes</h1>
          <p className="lead">Every submitted tape with Sammy Intelligence status, visibility, and score trajectory.</p>
        </div>
        <Link className="btn btn-primary" style={{ width: 'auto' }} to="/talent/feed">
          Find a call
        </Link>
      </div>

      <section className="bento discover-insights" aria-label="Audition insights">
        <article className="bento-tile insight insight-accent">
          <p className="kicker">Submitted</p>
          <div className="stat-num">{insights.total}</div>
          <p className="muted">Total tapes on Sammy</p>
        </article>
        <article className="bento-tile insight">
          <p className="kicker">Scored</p>
          <div className="stat-num">{insights.complete}</div>
          <p className="muted">Complete Intelligence reports</p>
        </article>
        <article className="bento-tile insight">
          <p className="kicker">Best score</p>
          <div className="stat-num">{insights.best ?? '—'}</div>
          <p className="muted">{insights.avg != null ? `Average ${insights.avg}` : 'Submit a take to unlock'}</p>
        </article>
        <article className="bento-tile insight">
          <p className="kicker">In flight</p>
          <div className="stat-num">{insights.pending}</div>
          <p className="muted">{insights.publicCount} public · rest private</p>
        </article>
      </section>

      <div className="filter-group" style={{ marginBottom: 16 }}>
        <p className="filter-label">Status</p>
        <div className="chip-row">
          {(
            [
              ['All', 'All takes'],
              ['complete', 'Scored'],
              ['processing', 'Processing'],
              ['queued', 'Queued'],
              ['error', 'Needs retry'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`chip ${status === key ? 'active' : ''}`}
              onClick={() => setStatus(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="bento discover-grid">
        {filtered.map((s, i) => (
          <Link
            key={s.id}
            className={`bento-tile thread-tile${i === 0 ? ' bento-feature' : ''}`}
            to={`/talent/score/${s.id}`}
          >
            <div className="thread-tile-top">
              <p className="kicker">{s.status} · {s.visibility}</p>
              {s.overall != null ? <span className="chip match">{s.overall}</span> : null}
            </div>
            <h3 className="h2">{s.roleTitle || 'Audition take'}</h3>
            <p className="muted">{s.stage || 'Sammy Intelligence'}</p>
            <div className="thread-meta">
              <span>{new Date(s.createdAt).toLocaleString()}</span>
              {s.decision && s.decision !== 'pending' ? <span>{s.decision}</span> : <span>Awaiting decision</span>}
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-panel">
          <h3 className="h2">{subs.length === 0 ? 'No auditions yet' : 'Nothing in this status'}</h3>
          <p className="muted">
            {subs.length === 0
              ? 'Open Discover, pick a role, and record with the teleprompter.'
              : 'Try another status filter.'}
          </p>
          <Link className="btn btn-secondary" style={{ width: 'auto', marginTop: 12 }} to="/talent/feed">
            Browse casting board
          </Link>
        </div>
      ) : null}
    </main>
  )
}
