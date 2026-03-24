'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useNotifications } from '@/contexts/NotificationContext'
import { t } from '@/i18n'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

const ICONS: Record<string, string> = {
  chat_message: '💬',
  chat_new_message: '💬',
  clairiere_message: '🌿',
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

type NotificationItem = { id: string; read_at?: string; action_url?: string; title?: string; body?: string; created_at?: string; type?: string; priority?: string; delivery_id?: string }

export default function NotificationCenter() {
  const { unreadCount, items, loading, fetchList, markRead, markAllRead, deleteRead } =
    useNotifications()
  const [open, setOpen] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const toggle = useCallback(() => {
    if (!open) fetchList({ per_page: 15 })
    setOpen((o) => !o)
  }, [open, fetchList])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (dropRef.current && !dropRef.current.contains(target) && !target.closest('[data-notification-dropdown]'))
        setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleClick = (notif: NotificationItem) => {
    if (!notif.read_at) markRead([notif.id])
    if (notif.action_url) {
      const path = notif.action_url.startsWith('/') ? notif.action_url : `/${notif.action_url}`
      router.push(path.replace(/^\/jardin\/?/, '/') || '/')
      setOpen(false)
    }
  }

  return (
    <>
      <div
        ref={dropRef}
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => e.key === 'Enter' && toggle()}
        className="relative flex flex-1 w-full items-center justify-center min-w-[44px] min-h-[44px] cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label={`${t('layout.notifications')}${unreadCount ? ` (${unreadCount})` : ''}`}
        title={unreadCount ? `${t('layout.notifications')} (${unreadCount})` : t('layout.notifications')}
      >
        <span className="relative flex items-center justify-center p-2 text-lg pointer-events-none">
          <svg
            className="w-5 h-5 text-slate-600 dark:text-slate-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold px-1 animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </span>
      </div>

      {open &&
        createPortal(
          (() => {
            const rect = dropRef.current?.getBoundingClientRect()
            return (
              <div
                data-notification-dropdown
                className="fixed w-80 sm:w-96 max-h-[70vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-[9999] flex flex-col overflow-hidden"
                style={
                  rect
                    ? { top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right), left: 'auto' }
                    : {}
                }
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Notifications
                    {unreadCount > 0 && (
                      <span className="ml-1.5 text-xs font-normal text-rose-500">({unreadCount})</span>
                    )}
                  </h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      Tout marquer lu
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto">
                  {loading && items.length === 0 ? (
                    <div className="flex items-center justify-center py-10">
                      <span className="w-5 h-5 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
                    </div>
                  ) : items.length === 0 ? (
                    <div className="py-10 text-center text-sm text-slate-400 italic">
                      Aucune notification
                    </div>
                  ) : (
                    items.map((n) => (
                      <button
                        key={(n as NotificationItem).delivery_id ?? n.id}
                        onClick={() => handleClick(n as NotificationItem)}
                        className={`w-full text-left px-4 py-3 flex gap-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                          !n.read_at ? 'bg-violet-50/50 dark:bg-violet-950/20' : ''
                        } ${PRIORITY_RING[(n as NotificationItem).priority ?? ''] ?? ''} border-b border-slate-50 dark:border-slate-800/50 last:border-b-0`}
                      >
                        <span className="text-lg shrink-0 mt-0.5">
                          {ICONS[(n as NotificationItem).type ?? ''] ?? '🔔'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <p
                              className={`text-sm leading-tight truncate ${
                                !n.read_at
                                  ? 'font-semibold text-slate-800 dark:text-slate-100'
                                  : 'text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {(n as NotificationItem).title}
                            </p>
                            {!n.read_at && (
                              <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0 mt-1.5" />
                            )}
                          </div>
                          {(n as NotificationItem).body && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                              {(n as NotificationItem).body}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-400 mt-1">
                            {timeAgo((n as NotificationItem).created_at ?? '')}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {items.length > 0 && (
                  <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-2 flex items-center justify-between gap-2">
                    {items.some((n) => n.read_at) ? (
                      <button
                        onClick={deleteRead}
                        className="text-xs text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400"
                      >
                        Effacer les lues
                      </button>
                    ) : (
                      <span />
                    )}
                    <button
                      onClick={() => {
                        router.push('/notifications')
                        setOpen(false)
                      }}
                      className="text-xs text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      Voir tout →
                    </button>
                  </div>
                )}
              </div>
            )
          })(),
          document.body
        )}
    </>
  )
}
