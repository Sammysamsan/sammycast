import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { Role } from '../lib/api'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const initial = (params.get('role') as Role) || 'talent'
  const [role, setRole] = useState<Role>(initial === 'production' ? 'production' : 'talent')
  const [email, setEmail] = useState(role === 'production' ? 'production@sammy.app' : 'talent@sammy.app')
  const [password, setPassword] = useState('demo')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const hint = useMemo(
    () =>
      role === 'production'
        ? 'Demo: production@sammy.app / demo'
        : 'Demo: talent@sammy.app / demo',
    [role],
  )

  const onRole = (next: Role) => {
    setRole(next)
    setEmail(next === 'production' ? 'production@sammy.app' : 'talent@sammy.app')
    setPassword('demo')
    setError(null)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email, password, role)
      navigate(role === 'production' ? '/production/dashboard' : '/talent/feed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-page rise">
      <Link to="/" className="brand-word" style={{ fontSize: '1.6rem' }}>
        Samm<span>y</span>
      </Link>
      <h1 className="h1" style={{ marginTop: 28 }}>
        Sign in to your world
      </h1>
      <p className="lead">
        Production and talent use separate logins — same casting engine underneath.
      </p>

      <div className="role-toggle">
        <button type="button" className={role === 'production' ? 'active' : ''} onClick={() => onRole('production')}>
          <strong>Production</strong>
          <span>Page · Threads · AI Review</span>
        </button>
        <button type="button" className={role === 'talent' ? 'active' : ''} onClick={() => onRole('talent')}>
          <strong>Talent</strong>
          <span>Feed · Record · Score</span>
        </button>
      </div>

      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        <p className="faint">{hint}</p>
        {error ? <p className="error">{error}</p> : null}
        <div className="btn-row">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : `Continue as ${role}`}
          </button>
          <Link className="btn btn-secondary" to="/">
            Back to landing
          </Link>
        </div>
      </form>
    </main>
  )
}
