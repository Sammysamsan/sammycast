import { useEffect, useState } from 'react'
import { fetchMessages, type Message } from '../../lib/api'

export function ProductionMessages() {
  const [messages, setMessages] = useState<Message[]>([])
  useEffect(() => { fetchMessages().then(setMessages) }, [])
  return (
    <main className="rise">
      <p className="kicker">Inbox</p>
      <h1 className="h1">Messages & invites</h1>
      <p className="lead">Callback invites you sent and replies from shortlisted talent.</p>
      <div className="bento" style={{ marginTop: 16 }}>
        {messages.map((m) => (
          <article key={m.id} className="bento-tile">
            <p className="kicker">{m.talentName}</p>
            <p className="muted">{m.body}</p>
            <p className="faint">{new Date(m.createdAt).toLocaleString()}</p>
          </article>
        ))}
      </div>
      {messages.length === 0 ? <p className="muted">No messages yet — shortlist talent from Review to invite them.</p> : null}
    </main>
  )
}
