import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { fetchPricing, updateCompanyProfile, type PricingPlan } from '../../lib/api'

type Tab = 'account' | 'plans' | 'privacy' | 'legal'

export function ProductionSettings() {
  const { company, logout, refresh } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('account')
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    fetchPricing().then((p) => setPlans(p.production))
  }, [])

  const choosePlan = async (plan: PricingPlan) => {
    if (plan.enterprise) {
      setNote('Enterprise sales will reach out — request logged for demo.')
      return
    }
    await updateCompanyProfile({ plan: plan.name })
    await refresh()
    setNote(`Switched to ${plan.name}.`)
  }

  return (
    <main className="rise">
      <p className="kicker">Studio settings</p>
      <h1 className="h1">Account, plans & policies</h1>
      <p className="lead">Billing, privacy controls, and the legal documents that keep casting compliant.</p>

      <div className="chip-row settings-tabs">
        {([
          ['account', 'Account'],
          ['plans', 'Plans & pricing'],
          ['privacy', 'Privacy'],
          ['legal', 'Legal'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" className={`chip ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'account' ? (
        <div className="bento">
          <article className="bento-tile">
            <p className="kicker">Team</p>
            <h3 className="h2">Meera Krishnan</h3>
            <p className="muted">Casting coordinator · owner seat</p>
          </article>
          <article className="bento-tile">
            <p className="kicker">Current plan</p>
            <h3 className="h2">{company?.plan || 'Studio'}</h3>
            <p className="muted">Change plans under Plans & pricing.</p>
          </article>
          <article className="bento-tile">
            <p className="kicker">Verification</p>
            <h3 className="h2">{company?.verified ? 'Verified' : 'Pending'}</h3>
            <p className="muted">GST / company ID or industry credential on file.</p>
          </article>
          <article className="bento-tile">
            <p className="kicker">Session</p>
            <button className="btn btn-secondary" type="button" onClick={() => { logout(); navigate('/login') }}>Sign out</button>
          </article>
        </div>
      ) : null}

      {tab === 'plans' ? (
        <div>
          <p className="muted" style={{ marginBottom: 14 }}>Production pricing — Indie, Studio, and Enterprise rates.</p>
          <div className="pricing-grid">
            {plans.map((plan) => (
              <article key={plan.id} className={`price-card ${plan.popular ? 'popular' : ''} ${plan.enterprise ? 'enterprise' : ''}`}>
                {plan.popular ? <span className="chip active">Most chosen</span> : null}
                {plan.enterprise ? <span className="chip verified">Enterprise</span> : null}
                <h3 className="h2">{plan.name}</h3>
                <div className="price-line"><strong>{plan.price}</strong><span>{plan.period}</span></div>
                <p className="muted">{plan.blurb}</p>
                <ul className="price-features">
                  {plan.features.map((f) => <li key={f}>{f}</li>)}
                </ul>
                <button type="button" className="btn btn-primary" onClick={() => void choosePlan(plan)}>
                  {plan.enterprise ? 'Talk to sales' : company?.plan === plan.name ? 'Current plan' : 'Choose plan'}
                </button>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {tab === 'privacy' ? (
        <div className="legal-block">
          <h2 className="h2">Privacy overview</h2>
          <p className="muted">Sammy processes audition videos to generate performance scores. Production teams only see tapes submitted to their threads.</p>
          <ul className="legal-list">
            <li>Talent choose public or private visibility on every submission.</li>
            <li>Private tapes are visible only to the posting studio&apos;s seats.</li>
            <li>AI scores and transcripts stay tied to the audition thread.</li>
            <li>You can request deletion of closed-thread media after 90 days.</li>
            <li>We do not sell personal data to advertisers.</li>
          </ul>
          <p className="faint">Full Privacy Policy available on request for enterprise contracts.</p>
        </div>
      ) : null}

      {tab === 'legal' ? (
        <div className="bento">
          <article className="bento-tile bento-wide">
            <p className="kicker">Terms of use</p>
            <h3 className="h2">Platform terms</h3>
            <p className="muted">By posting threads you confirm rights to the script and brief, and agree not to discriminate unlawfully in casting decisions.</p>
          </article>
          <article className="bento-tile">
            <p className="kicker">Content licence</p>
            <p className="muted">Studios receive a limited licence to review submitted tapes for casting the posted role.</p>
          </article>
          <article className="bento-tile">
            <p className="kicker">Data processing</p>
            <p className="muted">Enterprise DPAs available. India-first hosting with optional residency add-ons.</p>
          </article>
          <article className="bento-tile">
            <p className="kicker">Contact</p>
            <p className="muted">legal@sammy.app · billing@sammy.app</p>
          </article>
        </div>
      ) : null}

      {note ? <p className="faint" style={{ marginTop: 16 }}>{note}</p> : null}
    </main>
  )
}
