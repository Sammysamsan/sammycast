import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  closeThread,
  fetchThreadSubmissions,
  fetchThreads,
  sendInvite,
  setDecision,
  type Submission,
  type Thread,
} from '../../lib/api'

export function ReviewDashboard() {
  const [params] = useSearchParams()
  const [threads, setThreads] = useState<Thread[]>([])
  const [threadId, setThreadId] = useState(params.get('thread') || '')
  const [subs, setSubs] = useState<Submission[]>([])
  const [filterLang, setFilterLang] = useState('All')
  const [selected, setSelected] = useState<Submission | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    fetchThreads({ mine: true }).then((list) => {
      setThreads(list)
      if (!threadId && list[0]) setThreadId(list[0].id)
    })
  }, [])

  useEffect(() => {
    if (!threadId) return
    fetchThreadSubmissions(threadId).then(setSubs)
  }, [threadId])

  const filtered = useMemo(() => {
    return subs
      .filter((s) => s.status === 'complete')
      .filter((s) => (filterLang === 'All' ? true : (s.talentLanguages || '').includes(filterLang)))
      .sort((a, b) => (b.overall || 0) - (a.overall || 0))
  }, [subs, filterLang])

  const shortlisted = filtered.filter((s) => s.decision === 'shortlist')

  return (
    <main className="rise">
      <p className="kicker">AI shortlist</p>
      <h1 className="h1">Review submissions</h1>
      <p className="lead">Ranked by Sammy Intelligence — filter, open a tape, then shortlist or pass.</p>

      <div className="field" style={{ marginTop: 16 }}>
        <label>Thread</label>
        <select value={threadId} onChange={(e) => setThreadId(e.target.value)}>
          {threads.map((t) => (
            <option key={t.id} value={t.id}>{t.roleTitle}</option>
          ))}
        </select>
      </div>

      <div className="chip-row" style={{ marginBottom: 12 }}>
        {['All', 'Tamil', 'English'].map((l) => (
          <button key={l} type="button" className={`chip ${filterLang === l ? 'active' : ''}`} onClick={() => setFilterLang(l)}>{l}</button>
        ))}
        <span className="chip">Sort: AI score</span>
      </div>

      <div className="desktop-split">
        <div>
          <div className="card-list">
            {filtered.map((s) => (
              <button key={s.id} type="button" className="row-card" style={{ textAlign: 'left', width: '100%' }} onClick={() => setSelected(s)}>
                <div className="row-top">
                  <div>
                    <strong>{s.talentName}</strong>
                    <p className="muted">{s.talentCity} · {s.talentLanguages}</p>
                    <p className="faint">Sammy Score {s.talentScore} · {s.visibility} · {s.decision}</p>
                  </div>
                  <div className="score-pill">{s.overall ?? '—'}</div>
                </div>
              </button>
            ))}
            {filtered.length === 0 ? <p className="muted">No completed tapes yet for this thread.</p> : null}
          </div>
        </div>

        <div>
          {selected ? (
            <section className="banner" style={{ marginTop: 0, position: 'sticky', top: 24 }}>
              <p className="kicker">Submission detail</p>
              <h2 className="h2">{selected.talentName}</h2>
              <div className="score-hero">
                <div className="big">{selected.overall}</div>
                <div className="muted">Composite · Sammy Intelligence</div>
              </div>
              <div className="metrics">
                {(selected.report?.dimensions || selected.report?.metrics || []).map((d) => (
                  <article className="metric" key={d.key}>
                    <div className="metric-top"><strong>{d.label}</strong><span>{d.score}</span></div>
                    <div className="bar"><i style={{ width: `${d.score}%` }} /></div>
                    <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>{d.note}</p>
                  </article>
                ))}
              </div>
              <div className="btn-row">
                <button type="button" className="btn btn-primary" onClick={async () => {
                  const updated = await setDecision(selected.id, 'shortlist')
                  setSelected(updated)
                  setSubs((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
                }}>Shortlist</button>
                <button type="button" className="btn btn-secondary" onClick={async () => {
                  const updated = await setDecision(selected.id, 'pass')
                  setSelected(updated)
                  setSubs((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
                }}>Pass</button>
                <button type="button" className="btn btn-teal" onClick={async () => {
                  await sendInvite(selected.talentId, selected.threadId, `Invitation for ${selected.roleTitle} — please confirm a callback slot.`)
                  setMsg('Invite sent to Messages')
                }}>Message / invite</button>
              </div>
            </section>
          ) : (
            <p className="muted">Select a tape to open the score breakdown.</p>
          )}
        </div>
      </div>

      <div className="btn-row">
        <button type="button" className="btn btn-secondary" disabled={!shortlisted.length} onClick={async () => {
          for (const s of shortlisted) {
            await sendInvite(s.talentId, s.threadId, `Bulk invite: shortlisted for ${s.roleTitle}.`)
          }
          setMsg(`Invited ${shortlisted.length} shortlisted talent`)
        }}>Message shortlisted ({shortlisted.length})</button>
        <button type="button" className="btn btn-secondary" onClick={async () => {
          if (!threadId) return
          await closeThread(threadId)
          setMsg('Thread closed')
        }}>Close thread</button>
      </div>
      {msg ? <p className="faint">{msg}</p> : null}
      <p className="faint" style={{ marginTop: 8 }}><Link to="/production/messages">Open messages →</Link></p>
    </main>
  )
}
