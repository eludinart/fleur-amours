'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './AuthContext'
import { notificationsApi } from '@/api/notifications'

type NotificationItem = { id: string; read_at?: string; [k: string]: unknown }

type NotificationContextValue = {
  unreadCount: number
  items: NotificationItem[]
  loading: boolean
  fetchList: (params?: Record<string, unknown>) => Promise<unknown>
  fetchUnread: () => Promise<void>
  markRead: (ids: string[]) => Promise<void>
  markAllRead: () => Promise<void>
  deleteRead: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

const POLL_INTERVAL = 30_000

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchUnread = useCallback(async () => {
    const u = user as { id?: string; email?: string } | null
    if (!u?.id && !u?.email) return
    try {
      const data = (await notificationsApi.unreadCount()) as { unread?: number }
      setUnreadCount(data.unread ?? 0)
    } catch {
      /* silent */
    }
  }, [(user as { id?: string })?.id, (user as { email?: string })?.email])

  const fetchList = useCallback(
    async (params: Record<string, unknown> = {}) => {
      const u = user as { id?: string; email?: string } | null
      if (!u?.id && !u?.email) return null
      setLoading(true)
      try {
        const data = (await notificationsApi.list(params)) as { items?: NotificationItem[]; unread?: number }
        setItems(data.items ?? [])
        setUnreadCount(data.unread ?? 0)
        return data
      } catch {
        return null
      } finally {
        setLoading(false)
      }
    },
    [(user as { id?: string })?.id, (user as { email?: string })?.email]
  )

  const markRead = useCallback(async (ids: string[]) => {
    if (!ids?.length) return
    try {
      await notificationsApi.markRead(ids)
      setItems((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n))
      )
      await fetchUnread()
    } catch {
      /* silent */
    }
  }, [fetchUnread])

  const markAllRead = useCallback(async () => {
    try {
      await notificationsApi.markAllRead()
      setItems((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      )
      await fetchUnread()
    } catch {
      /* silent */
    }
  }, [fetchUnread])

  const deleteRead = useCallback(async () => {
    try {
      await notificationsApi.deleteRead()
      setItems((prev) => prev.filter((n) => !n.read_at))
      fetchUnread()
    } catch {
      /* silent */
    }
  }, [fetchUnread])

  useEffect(() => {
    const u = user as { id?: string; email?: string } | null
    if (!u?.id && !u?.email) {
      setUnreadCount(0)
      setItems([])
      return
    }
    // Pas d'appel à ensure_tables ici : GET /api/notifications/unread_count et list
    // appellent déjà ensureNotificationsTables() côté serveur (évite DDL en double + ~10–15s).
    fetchUnread()
    pollRef.current = setInterval(fetchUnread, POLL_INTERVAL)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [(user as { id?: string })?.id, (user as { email?: string })?.email, fetchUnread])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchUnread()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [fetchUnread])

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        items,
        loading,
        fetchList,
        fetchUnread,
        markRead,
        markAllRead,
        deleteRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}
