import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { daysLeft, deadlineDays, fetchThreads, parseLanguages, type Thread } from '../../lib/api'

function matchScore(thread: Thread, userLangs: string[], userCity?: string | null) {
  let score = 0
  if (userLangs.some((l) => l.toLowerCase() === thread.language.toLowerCase())) score += 3
  if (userCity && thread.city && userCity.toLowerCase() === thread.city.toLowerCase()) score += 2
  if (deadlineDays(thread.deadline) <= 2) score += 1
  return score
}

export function RecordHome() {
  const { user } = useAuth()
  const [threads, setThreads] = useState<Thread[]>([])

  useEffect(() => {
    fetchThreads({ status: 'open' }).then(setThreads)
  }, [])

  const userLangs = useMemo(() => parseLanguages(user?.languages), [user?.languages])

  const ranked = useMemo(() => {
    return [...threads].sort(
      (a, b) => matchScore(b, userLangs, user?.city) - matchScore(a, userLangs, user?.city),
    )
  }, [threads, userLangs, user?.city])

  const urgent = threads.filter((t) => deadlineDays(t.deadline) <= 2).length

  return (
    <main className="rise">
      <div className="page-head">
        <div>
          <p className="kicker">Recording studio</p>
          <h1 className="h1">Choose a role to tape</h1>
          <p className="lead">Jump into the teleprompter for any open call — ranked by fit to your languages and city.</p>
        </div>
        <Link className="btn btn-secondary" style={{ width: 'auto' }} to="/talent/feed">
          Full board
        </Link>
      </div>

      <section className="bento discover-insights" aria-label="Record insights">
        <article className="bento-tile insight insight-accent">
          <p className="kicker">Ready to tape</p>
          <div className="stat-num">{threads.length}</div>
          <p className="muted">Open casting scripts</p>
        </article>
        <article className="bento-tile insight">
          <p className="kicker">Urgent</p>
          <div className="stat-num">{urgent}</div>
          <p className="muted">Closing inside 48 hours</p>
        </article>
        <article className="bento-tile insight bento-wide">
          <p className="kicker">Tip</p>
          <h3 className="h2">Record once, score five dimensions</h3>
          <p className="muted">
            Script accuracy, delivery, timing, reaction, and screen presence — then iterate from the coach notes.
          </p>
        </article>
      </section>

      <div className="bento discover-grid">
        {ranked.map((t, i) => {
          const fit = matchScore(t, userLangs, user?.city)
          return (
            <Link
              key={t.id}
              className={`bento-tile thread-tile${i === 0 ? ' bento-feature' : ''}${deadlineDays(t.deadline) <= 2 ? ' is-urgent' : ''}`}
              to={`/talent/audition/${t.id}`}
            >
              <div className="thread-tile-top">
                <p className="kicker">{t.companyName}</p>
                {fit >= 3 ? <span className="chip match">Fit</span> : null}
              </div>
              <h3 className="h2">{t.roleTitle}</h3>
              <p className="muted clamp-2">{t.characterBrief}</p>
              <div className="thread-meta">
                <span>{t.language}</span>
                <span>{t.genre}</span>
                <span>{t.city || 'Remote'}</span>
                <span>{daysLeft(t.deadline)}</span>
              </div>
            </Link>
          )
        })}
      </div>
    </main>
  )
}
