import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

export function ProductionShell() {
  const { company } = useAuth()
  return (
    <div className="app-frame">
      <aside className="side-nav" aria-label="Production">
        <div className="side-brand">
          <div className="brand-word">Samm<span>y</span></div>
          <p className="faint">Production</p>
        </div>
        <nav className="side-links">
          <NavLink to="/production/dashboard">Dashboard</NavLink>
          <NavLink to="/production/threads">Threads</NavLink>
          <NavLink to="/production/review">Review</NavLink>
          <NavLink to="/production/messages">Messages</NavLink>
          <NavLink to="/production/settings">Settings</NavLink>
        </nav>
        <div className="side-meta">
          <strong>{company?.name || 'Studio'}</strong>
          <span>{company?.city}</span>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-top">
          <p className="kicker">Production · {company?.name || 'Studio'}</p>
          <NavLink className="chip" to="/production/threads/new">New thread</NavLink>
        </header>
        <div className="app-content">
          <Outlet />
        </div>
      </div>

      <nav className="bottom-nav mobile-only" aria-label="Production mobile">
        <NavLink to="/production/dashboard"><span className="nav-ico">▣</span>Home</NavLink>
        <NavLink to="/production/threads"><span className="nav-ico">☰</span>Threads</NavLink>
        <NavLink to="/production/review"><span className="nav-ico">✦</span>Review</NavLink>
        <NavLink to="/production/messages"><span className="nav-ico">✉</span>Inbox</NavLink>
        <NavLink to="/production/settings"><span className="nav-ico">⚙</span>Settings</NavLink>
      </nav>
    </div>
  )
}
