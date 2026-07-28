import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { Role } from '../lib/api'

export function RequireAuth({ role }: { role: Role }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <main className="pad"><p className="muted">Loading…</p></main>
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (user.role !== role) {
    return <Navigate to={user.role === 'production' ? '/production/dashboard' : '/talent/feed'} replace />
  }
  return <Outlet />
}
