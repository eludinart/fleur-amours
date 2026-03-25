'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { authApi } from '@/api/auth'

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
        if (token && typeof window !== 'undefined') localStorage.setItem('auth_token', token)
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

  const bootstrap = useCallback(async () => {
    if (typeof window === 'undefined') return
    const token = localStorage.getItem('auth_token')
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const u = (await authApi.me()) as Record<string, unknown>
      setUser(u)
      localStorage.setItem('auth_user', JSON.stringify(u))
      scheduleRefresh(forceLogout)
    } catch {
      forceLogout()
    }
    setLoading(false)
  }, [scheduleRefresh, forceLogout])

  useEffect(() => {
    bootstrap()
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current)
    }
  }, [bootstrap])

  const login = async (loginId: string, password: string) => {
    const { token, user: u } = (await authApi.login(loginId, password)) as { token: string; user: Record<string, unknown> }
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token)
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
      localStorage.setItem('auth_token', token)
      localStorage.setItem('auth_user', JSON.stringify(u))
    }
    setUser(u)
    scheduleRefresh(forceLogout)
    return u
  }

  const logout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
    }
    setUser(null)
    if (refreshTimer.current) clearInterval(refreshTimer.current)
    refreshTimer.current = null
  }

  const refreshUser = useCallback(async () => {
    if (typeof window === 'undefined') return
    const token = localStorage.getItem('auth_token')
    if (!token) return
    try {
      const u = (await authApi.me()) as Record<string, unknown>
      setUser(u)
      localStorage.setItem('auth_user', JSON.stringify(u))
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
