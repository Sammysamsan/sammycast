import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchMe, fetchSubmission, type Submission, type User } from '../../lib/api'

export function ScoreCard() {
  const { id = '' } = useParams()
  const [sub, setSub] = useState<Submission | null>(null)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    let alive = true
    let timer: number | undefined
    const poll = async () => {
      const row = await fetchSubmission(id)
      if (!alive) return
      setSub(row)
      if (row.status === 'complete' || row.status === 'error') {
        const me = await fetchMe()
        if (alive) setUser(me.user)
        return
      }
      timer = window.setTimeout(poll, 1200)
    }
    poll()
    return () => { alive = false; if (timer) window.clearTimeout(timer) }
  }, [id])

  if (!sub || sub.status !== 'complete' || !sub.report) {
    return (
      <main className="analyzing rise">
        <div className="ring" />
        <h1 className="h1">{sub?.status === 'error' ? 'Scoring failed' : 'Sammy Intelligence'}</h1>
        <p className="muted">{sub?.error || sub?.stage || 'Reading your performance…'}</p>
        <p className="faint">{sub?.fileName}</p>
      </main>
    )
  }

  const dims = sub.report.dimensions || sub.report.metrics || []

  return (
    <main className="rise">
      <p className="kicker">AI score card</p>
      <h1 className="h1">Your score</h1>
      <div className="score-hero">
        <div className="big">{sub.overall}</div>
        <div>
          <div className="muted">Composite</div>
          <div className="faint">{sub.roleTitle}</div>
        </div>
      </div>
      <p className="lead">{sub.report.writtenFeedback || sub.report.summary}</p>
      <div className="metrics" style={{ marginTop: 18 }}>
        {dims.map((d) => (
          <article className="metric" key={d.key}>
            <div className="metric-top"><strong>{d.label}</strong><span>{d.score}</span></div>
            <div className="bar"><i style={{ width: `${d.score}%` }} /></div>
            <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>{d.note}</p>
          </article>
        ))}
      </div>
      {user ? (
        <section className="banner" style={{ marginTop: 18 }}>
          <p className="kicker">Sammy Score impact</p>
          <div className="brand-word" style={{ fontSize: '2.6rem' }}>{user.sammyScore}</div>
          <p className="muted">Range 300–900 · updates from every measured audition</p>
        </section>
      ) : null}
      <div className="btn-row">
        <Link className="btn btn-primary" to="/talent/profile">View Sammy Score</Link>
        <Link className="btn btn-secondary" to="/talent/auditions">My auditions</Link>
      </div>
    </main>
  )
}
