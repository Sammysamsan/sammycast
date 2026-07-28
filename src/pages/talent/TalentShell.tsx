import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

export function TalentShell() {
  const { user } = useAuth()
  return (
    <div className="app-frame">
      <aside className="side-nav" aria-label="Talent">
        <div className="side-brand">
          <div className="brand-word">Samm<span>y</span></div>
          <p className="faint">Talent</p>
        </div>
        <nav className="side-links">
          <NavLink to="/talent/feed">Discover</NavLink>
          <NavLink to="/talent/auditions">Auditions</NavLink>
          <NavLink to="/talent/record" className="side-record">Record</NavLink>
          <NavLink to="/talent/profile">Dashboard</NavLink>
          <NavLink to="/talent/more">More</NavLink>
        </nav>
        <div className="side-meta">
          <strong>{user?.name}</strong>
          <span>Sammy Score {user?.sammyScore}</span>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-top">
          <p className="kicker">Talent · {user?.city || 'India'}</p>
          <NavLink className="chip active" to="/talent/record">Record</NavLink>
        </header>
        <div className="app-content">
          <Outlet />
        </div>
      </div>

      <nav className="bottom-nav mobile-only" aria-label="Talent mobile">
        <NavLink to="/talent/feed"><span className="nav-ico">◎</span>Discover</NavLink>
        <NavLink to="/talent/auditions"><span className="nav-ico">▤</span>Takes</NavLink>
        <NavLink to="/talent/record" className="record-link"><span className="record-accent">●</span></NavLink>
        <NavLink to="/talent/profile"><span className="nav-ico">☺</span>Profile</NavLink>
        <NavLink to="/talent/more"><span className="nav-ico">⋯</span>More</NavLink>
      </nav>
    </div>
  )
}
