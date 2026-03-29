'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { authApi } from '@/api/auth'
import { isCapacitor } from '@/lib/api-client'

type User = Record<string, unknown> | null

type AuthContextValue = {
  user: User
  loading: boolean
  login: (loginId: string, password: string) => Promise<User>
  register: (email: string, password: string, name?: string, inviteToken?: string) => Promise<User>
  logout: () => void
  refreshUser: () => Promise<void>
  isAdmin: boolean
  isCoach: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null)
  const [loading, setLoading] = useState(true)
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const scheduleRefresh = useCallback((doForceLogout: () => void) => {
    if (refreshTimer.current) clearInterval(refreshTimer.current)
    refreshTimer.current = setInterval(async () => {
      try {
        const { token } = (await authApi.refresh()) as { token: string }
        // Sur Capacitor, stocker le nouveau token dans localStorage
        if (token && isCapacitor() && typeof window !== 'undefined') {
          localStorage.setItem('auth_token', token)
        }
      } catch {
        doForceLogout()
      }
    }, REFRESH_INTERVAL_MS)
  }, [])

  const forceLogout = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
    }
    setUser(null)
    if (refreshTimer.current) clearInterval(refreshTimer.current)
    refreshTimer.current = null
  }, [])

  /**
   * Bootstrap : appelle /api/auth/me si et seulement si une session est probable.
   *
   * On ne peut pas lire le cookie httpOnly depuis JS, donc on utilise `auth_user`
   * (mis en localStorage à chaque login/register/bootstrap réussi) comme sentinelle.
   * Sur Capacitor, on vérifie aussi `auth_token`.
   *
   * Sans sentinelle → on est certain de ne pas être connecté → early return.
   * Avec sentinelle → on tente me() :
   *   - Web      : le cookie httpOnly est envoyé automatiquement (credentials: include).
   *   - Capacitor: le Bearer token depuis localStorage est envoyé en header.
   */
  const bootstrap = useCallback(async () => {
    if (typeof window === 'undefined') {
      setLoading(false)
      return
    }
    const hasSessionHint =
      !!localStorage.getItem('auth_user') ||
      (isCapacitor() && !!localStorage.getItem('auth_token'))
    if (!hasSessionHint) {
      setLoading(false)
      return
    }
    try {
      const u = (await authApi.me()) as Record<string, unknown>
      setUser(u)
      localStorage.setItem('auth_user', JSON.stringify(u))
      scheduleRefresh(forceLogout)
    } catch {
      // Session expirée ou révoquée côté serveur
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
    } finally {
      setLoading(false)
    }
  }, [scheduleRefresh, forceLogout])

  useEffect(() => {
    bootstrap()
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current)
    }
  }, [bootstrap])

  const login = async (loginId: string, password: string) => {
    const { token, user: u } = (await authApi.login(loginId, password)) as {
      token: string
      user: Record<string, unknown>
    }
    if (typeof window !== 'undefined') {
      // Sur Capacitor : stocker le token (le cookie ne fonctionne pas cross-origin)
      // Sur web      : le cookie httpOnly est posé par le serveur, pas besoin de localStorage
      if (isCapacitor()) localStorage.setItem('auth_token', token)
      localStorage.setItem('auth_user', JSON.stringify(u))
    }
    setUser(u)
    scheduleRefresh(forceLogout)
    return u
  }

  const register = async (email: string, password: string, name = '', inviteToken?: string) => {
    const { token, user: u } = (await authApi.register(email, password, name, inviteToken)) as {
      token: string
      user: Record<string, unknown>
    }
    if (typeof window !== 'undefined') {
      if (isCapacitor()) localStorage.setItem('auth_token', token)
      localStorage.setItem('auth_user', JSON.stringify(u))
    }
    setUser(u)
    scheduleRefresh(forceLogout)
    return u
  }

  const logout = () => {
    // Efface le cookie httpOnly côté serveur
    authApi.logout().catch(() => {/* non bloquant */})
    // Nettoyer localStorage (Capacitor + cache user)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
    }
    setUser(null)
    if (refreshTimer.current) clearInterval(refreshTimer.current)
    refreshTimer.current = null
  }

  const refreshUser = useCallback(async () => {
    try {
      const u = (await authApi.me()) as Record<string, unknown>
      setUser(u)
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_user', JSON.stringify(u))
      }
    } catch {
      /* ignore */
    }
  }, [])

  const norm = (v: unknown) => (v == null ? '' : String(v).trim().toLowerCase())
  const appRole = norm(user?.app_role)
  const wpRole = norm(user?.wp_role)
  const jwtRole = norm((user as Record<string, unknown> | null)?.role)
  const isAdmin =
    appRole === 'admin' ||
    wpRole === 'administrator' ||
    jwtRole === 'admin' ||
    false
  const isCoach = appRole === 'coach' || jwtRole === 'coach'

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, isAdmin, isCoach }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
