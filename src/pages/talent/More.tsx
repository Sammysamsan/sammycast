import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import {
  fetchLeaderboard,
  fetchMessages,
  fetchPricing,
  type Message,
  type PricingPlan,
} from '../../lib/api'

type Tab = 'leaderboard' | 'notifications' | 'plans' | 'privacy' | 'legal'

export function TalentMore() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('leaderboard')
  const [board, setBoard] = useState<{ id: string; name: string; city: string; languages: string; sammyScore: number }[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    fetchLeaderboard().then(setBoard)
    fetchMessages().then(setMessages)
    fetchPricing().then((p) => setPlans(p.talent))
  }, [])

  return (
    <main className="rise">
      <p className="kicker">More</p>
      <h1 className="h1">Scoreboard, plans & policies</h1>
      <p className="lead">Track the week&apos;s rankings, manage your actor plan, and review privacy controls.</p>

      <div className="chip-row settings-tabs">
        {([
          ['leaderboard', 'Leaderboard'],
          ['notifications', 'Notifications'],
          ['plans', 'Plans & pricing'],
          ['privacy', 'Privacy'],
          ['legal', 'Legal'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" className={`chip ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'leaderboard' ? (
        <div className="bento">
          {board.slice(0, 6).map((row, i) => (
            <article key={row.id} className={`bento-tile ${i === 0 ? 'bento-feature' : ''}`}>
              <p className="kicker">Rank {i + 1}</p>
              <h3 className="h2">{row.name}</h3>
              <div className="stat-num">{row.sammyScore}</div>
              <p className="faint">{row.city} · {row.languages}</p>
            </article>
          ))}
        </div>
      ) : null}

      {tab === 'notifications' ? (
        <div className="bento">
          {messages.map((m) => (
            <article key={m.id} className="bento-tile">
              <p className="kicker">{m.companyName}</p>
              <p className="muted">{m.body}</p>
              <p className="faint">{new Date(m.createdAt).toLocaleString()}</p>
            </article>
          ))}
          {messages.length === 0 ? <p className="muted">No invitations yet — keep submitting tapes.</p> : null}
        </div>
      ) : null}

      {tab === 'plans' ? (
        <div>
          <p className="muted" style={{ marginBottom: 14 }}>Talent pricing — separate from studio enterprise rates.</p>
          <div className="pricing-grid">
            {plans.map((plan) => (
              <article key={plan.id} className={`price-card ${plan.popular ? 'popular' : ''}`}>
                {plan.popular ? <span className="chip active">Popular</span> : null}
                <h3 className="h2">{plan.name}</h3>
                <div className="price-line"><strong>{plan.price}</strong><span>{plan.period}</span></div>
                <p className="muted">{plan.blurb}</p>
                <ul className="price-features">{plan.features.map((f) => <li key={f}>{f}</li>)}</ul>
                <button type="button" className="btn btn-primary" onClick={() => setNote(`Selected ${plan.name} (demo).`)}>
                  {plan.price === '₹0' ? 'Stay on Starter' : 'Upgrade'}
                </button>
              </article>
            ))}
          </div>
          <p className="faint" style={{ marginTop: 12 }}>Signed in as {user?.name}. Production Enterprise pricing lives under studio Settings.</p>
        </div>
      ) : null}

      {tab === 'privacy' ? (
        <div className="legal-block">
          <h2 className="h2">Your privacy on Sammy</h2>
          <ul className="legal-list">
            <li>You choose public or private visibility before every submit — no silent default.</li>
            <li>Public replies appear on the thread; private tapes go only to that studio.</li>
            <li>Sammy Score uses your audition history, not third-party credit data.</li>
            <li>You can hide your profile from discovery while keeping past applications.</li>
            <li>Request data export or account deletion from support@sammy.app.</li>
          </ul>
        </div>
      ) : null}

      {tab === 'legal' ? (
        <div className="bento">
          <article className="bento-tile bento-wide">
            <p className="kicker">Talent terms</p>
            <p className="muted">You retain ownership of your performances. Sammy gets a licence to process, score, and display tapes per your visibility choice.</p>
          </article>
          <article className="bento-tile">
            <p className="kicker">Community</p>
            <p className="muted">No harassment, deepfakes, or impersonation. Violations can freeze scoring privileges.</p>
          </article>
          <article className="bento-tile">
            <p className="kicker">Contact</p>
            <p className="muted">support@sammy.app · privacy@sammy.app</p>
          </article>
        </div>
      ) : null}

      {note ? <p className="faint" style={{ marginTop: 14 }}>{note}</p> : null}
      <div className="btn-row" style={{ marginTop: 20 }}>
        <Link className="btn btn-secondary" to="/talent/profile">Go to profile</Link>
        <button type="button" className="btn btn-secondary" onClick={() => { logout(); navigate('/login') }}>Sign out</button>
      </div>
    </main>
  )
}
