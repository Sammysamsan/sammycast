import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { daysLeft, fetchThread, type Thread } from '../../lib/api'

export function ThreadDetail() {
  const { id = '' } = useParams()
  const [thread, setThread] = useState<Thread | null>(null)

  useEffect(() => {
    fetchThread(id).then(setThread)
  }, [id])

  if (!thread) return <p className="muted">Loading thread…</p>

  return (
    <main className="rise">
      <p className="kicker">{thread.companyName} {thread.companyVerified ? '· Verified' : ''}</p>
      <h1 className="h1">{thread.roleTitle}</h1>
      <div className="chip-row" style={{ margin: '12px 0' }}>
        <span className="chip">{thread.language}</span>
        <span className="chip">{thread.genre}</span>
        <span className="chip">{daysLeft(thread.deadline)}</span>
        <span className="chip">{thread.city}</span>
      </div>
      <section className="row-card">
        <h2 className="h2">Character brief</h2>
        <p className="muted">{thread.characterBrief}</p>
      </section>
      <section className="row-card">
        <h2 className="h2">Script</h2>
        <p className="script-block">{thread.scriptText}</p>
      </section>
      {(thread.publicReplies || []).length > 0 ? (
        <section className="row-card">
          <h2 className="h2">Public replies</h2>
          {(thread.publicReplies || []).map((r) => (
            <div key={r.id} className="row-top" style={{ marginTop: 10 }}>
              <div>
                <strong>{r.talentName}</strong>
                <p className="faint">{r.talentCity}</p>
              </div>
              <div className="score-pill">{r.overall}</div>
            </div>
          ))}
        </section>
      ) : null}
      <div className="sticky-cta">
        <Link className="btn btn-primary" to={`/talent/audition/${thread.id}`}>Audition now</Link>
      </div>
    </main>
  )
}
