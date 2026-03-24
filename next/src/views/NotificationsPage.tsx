'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useNotifications } from '@/contexts/NotificationContext'
import { notificationsApi } from '@/api/notifications'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

const ICONS: Record<string, string> = {
  chat_message: '💬',
  chat_new_message: '💬',
  admin_announcement: '📢',
  targeted: '🎯',
  contact_reply: '✉️',
  system: '⚙️',
}

const PRIORITY_RING: Record<string, string> = {
  urgent: 'ring-2 ring-rose-500',
  high: 'ring-2 ring-amber-400',
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  return `il y a ${days}j`
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

type NotifItem = {
  id?: number
  delivery_id?: number
  read_at?: string | null
  action_url?: string | null
  title?: string
  body?: string | null
  type?: string
  priority?: string
  created_at?: string
}

export default function NotificationsPage() {
  const { unreadCount, markRead, markAllRead, deleteRead, fetchUnread } = useNotifications()
  const [items, setItems] = useState<NotifItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const load = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const data = (await notificationsApi.list({ page: p, per_page: 25 })) as { items?: NotifItem[]; total?: number }
      setItems(data.items ?? [])
      setTotal(data.total ?? 0)
      setPage(p)
      fetchUnread()
    } catch { /* silent */ }
    setLoading(false)
  }, [fetchUnread])

  useEffect(() => { load(1) }, [load])

  const handleClick = (notif: NotifItem) => {
    if (!notif.read_at) markRead([String(notif.delivery_id ?? notif.id)])
    if (notif.action_url) router.push(notif.action_url.replace(/^\/jardin\/?/, '/') || '/')
  }

  const pages = Math.max(1, Math.ceil(total / 25))

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Notifications</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {total} notification{total !== 1 ? 's' : ''}
            {unreadCount > 0 && (
              <span className="ml-2 text-rose-500 font-medium">· {unreadCount} non lue{unreadCount > 1 ? 's' : ''}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={async () => { await markAllRead(); load(page) }}
              className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
            >
              Tout marquer lu
            </button>
          )}
          {items.some(n => n.read_at) && (
            <button
              onClick={async () => { await deleteRead(); load(page) }}
              className="text-xs font-medium text-slate-500 hover:text-rose-500 dark:hover:text-rose-400"
            >
              Effacer les lues
            </button>
          )}
          <Link
            href="/notifications/preferences"
            className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            Préférences
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <span className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-slate-500 italic">
            Aucune notification
          </div>
        ) : (
          items.map(n => (
            <button
              key={n.delivery_id ?? n.id ?? 0}
              onClick={() => handleClick(n)}
              className={`w-full text-left px-5 py-4 flex gap-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50
                ${!n.read_at ? 'bg-violet-50/30 dark:bg-violet-950/20' : ''}
                ${PRIORITY_RING[n.priority ?? ''] ?? ''}`}
            >
              <span className="text-2xl shrink-0 mt-0.5">{ICONS[n.type ?? ''] ?? '🔔'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <p className={`text-sm leading-tight ${!n.read_at ? 'font-semibold text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}`}>
                    {n.title}
                  </p>
                  {!n.read_at && (
                    <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0 mt-1.5" />
                  )}
                </div>
                {n.body && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{n.body}</p>
                )}
                <p className="text-xs text-slate-400 mt-2">{formatDate(n.created_at)}</p>
              </div>
              {n.action_url && (
                <span className="text-sm text-violet-500 shrink-0 self-center">→</span>
              )}
            </button>
          ))
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => load(page - 1)}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            ← Précédent
          </button>
          <span className="text-sm text-slate-500">Page {page} / {pages}</span>
          <button
            disabled={page >= pages}
            onClick={() => load(page + 1)}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  )
}
