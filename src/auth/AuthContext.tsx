import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  clearSession,
  fetchMe,
  getSession,
  login as apiLogin,
  saveSession,
  type Company,
  type Role,
  type User,
} from '../lib/api'

type AuthState = {
  user: User | null
  company: Company | null
  loading: boolean
  login: (email: string, password: string, role: Role) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    const { userId } = getSession()
    if (!userId) {
      setUser(null)
      setCompany(null)
      setLoading(false)
      return
    }
    try {
      const data = await fetchMe()
      setUser(data.user)
      setCompany(data.company)
    } catch {
      clearSession()
      setUser(null)
      setCompany(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      company,
      loading,
      refresh,
      logout: () => {
        clearSession()
        setUser(null)
        setCompany(null)
      },
      login: async (email, password, role) => {
        const data = await apiLogin(email, password, role)
        saveSession(data.user.id, data.user.role)
        setUser(data.user)
        setCompany(data.company)
      },
    }),
    [user, company, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('AuthProvider missing')
  return ctx
}
