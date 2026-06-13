'use client'

import { createContext, useContext, useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { myceliumApi, type MyceliumAccessDTO } from '@/api/mycelium'

const DEFAULT_ACCESS: MyceliumAccessDTO = {
  member: false,
  canManage: false,
  orgId: null,
  orgName: null,
  orgRole: null,
  isAppAdmin: false,
  showAdmin: false,
  showDashboard: false,
  showEspace: false,
}

type MyceliumAccessContextValue = {
  access: MyceliumAccessDTO | null
  loading: boolean
  refresh: () => void
}

const MyceliumAccessContext = createContext<MyceliumAccessContextValue | null>(null)

let globalMyceliumAccessRefresh: (() => void) | null = null

function userIdOf(user: Record<string, unknown> | null): string {
  if (!user?.id) return ''
  return String(user.id)
}

/** Droits Mycelium partagés (sidebar + guards) — une seule requête API. */
export function MyceliumAccessProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const userId = userIdOf(user as Record<string, unknown> | null)
  const [access, setAccess] = useState<MyceliumAccessDTO | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchAccess = useCallback((opts?: { silent?: boolean }) => {
    if (!userId) {
      setAccess(null)
      setLoading(false)
      return
    }
    if (!opts?.silent) setLoading(true)
    myceliumApi
      .access()
      .then(setAccess)
      .catch(() => setAccess(DEFAULT_ACCESS))
      .finally(() => setLoading(false))
  }, [userId])

  useEffect(() => {
    fetchAccess()
    globalMyceliumAccessRefresh = () => fetchAccess({ silent: true })
    return () => {
      globalMyceliumAccessRefresh = null
    }
  }, [fetchAccess])

  return (
    <MyceliumAccessContext.Provider
      value={{ access, loading, refresh: () => fetchAccess({ silent: true }) }}
    >
      {children}
    </MyceliumAccessContext.Provider>
  )
}

export function useMyceliumAccess(enabled = true): MyceliumAccessContextValue {
  const ctx = useContext(MyceliumAccessContext)
  if (ctx) {
    if (!enabled) {
      return { access: ctx.access, loading: false, refresh: ctx.refresh }
    }
    return ctx
  }
  const { user } = useAuth()
  const userId = userIdOf(user as Record<string, unknown> | null)
  const [access, setAccess] = useState<MyceliumAccessDTO | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchAccess = useCallback(() => {
    if (!enabled || !userId) {
      setAccess(null)
      setLoading(false)
      return
    }
    setLoading(true)
    myceliumApi
      .access()
      .then(setAccess)
      .catch(() => setAccess(DEFAULT_ACCESS))
      .finally(() => setLoading(false))
  }, [enabled, userId])

  useEffect(() => {
    fetchAccess()
  }, [fetchAccess])

  return { access, loading, refresh: fetchAccess }
}

export function invalidateMyceliumAccessCache() {
  globalMyceliumAccessRefresh?.()
}
