'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { chatApi } from '@/api/chat'
import { t } from '@/i18n'
import { useAuth } from '@/contexts/AuthContext'

type CoRow = {
  id: string
  status: string
  last_message_at: string | null
  created_at: string | null
}

function parseRows(r: unknown): CoRow[] {
  const data = r as {
    conversations?: Array<{
      id: string
      status?: string
      last_message_at?: string | null
      created_at?: string | null
    }>
  }
  const raw = data?.conversations ?? []
  return raw.map((c) => ({
    id: String(c.id),
    status: String(c.status ?? 'open'),
    last_message_at: c.last_message_at ? String(c.last_message_at) : null,
    created_at: c.created_at ? String(c.created_at) : null,
  }))
}

function sortCoachingRows(list: CoRow[]): CoRow[] {
  return [...list].sort((a, b) => {
    const aOpen = a.status === 'open' ? 1 : 0
    const bOpen = b.status === 'open' ? 1 : 0
    if (bOpen !== aOpen) return bOpen - aOpen
    const ta = new Date(a.last_message_at || a.created_at || 0).getTime()
    const tb = new Date(b.last_message_at || b.created_at || 0).getTime()
    return tb - ta
  })
}

function formatActivity(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return t('chat.historyJustNow')
  if (diff < 3600000) return t('chat.historyMinutesAgo', { n: Math.floor(diff / 60000) })
  if (diff < 86400000) return t('chat.historyHoursAgo', { n: Math.floor(diff / 3600000) })
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Sur le formulaire accompagnement : conversations ouvertes très visibles, sinon lien discret vers l’historique chat.
 */
export function ContactAccompanimentChatCtas() {
  const { user } = useAuth()
  const [rows, setRows] = useState<CoRow[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!user) {
      setLoaded(true)
      return
    }
    let cancelled = false
    chatApi
      .myConversations()
      .then((r) => {
        if (!cancelled) setRows(parseRows(r))
      })
      .catch(() => {
        if (!cancelled) setRows([])
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const openRows = useMemo(() => {
    return sortCoachingRows(rows).filter((r) => r.status === 'open')
  }, [rows])

  if (!user) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 px-4 py-3 text-sm">
        <Link
          href="/chat?history=1"
          className="font-medium text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-200 underline-offset-2 hover:underline"
        >
          {t('contact.linkChatHistory')}
        </Link>
      </div>
    )
  }

  if (!loaded) {
    return (
      <div
        className="h-28 rounded-2xl bg-slate-200/50 dark:bg-slate-800/50 animate-pulse border-2 border-emerald-300/40 dark:border-emerald-700/40"
        aria-busy="true"
        aria-label={t('contact.openChatsLoading')}
      />
    )
  }

  if (openRows.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 px-4 py-3 text-sm">
        <Link
          href="/chat?history=1"
          className="font-medium text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-200 underline-offset-2 hover:underline"
        >
          {t('contact.linkChatHistory')}
        </Link>
      </div>
    )
  }

  const title =
    openRows.length === 1
      ? t('contact.openChatsTitleOne')
      : t('contact.openChatsTitleMany', { n: openRows.length })

  return (
    <section
      className="relative overflow-hidden rounded-2xl border-[3px] border-emerald-500 dark:border-emerald-400 bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-50 dark:from-emerald-950/90 dark:via-teal-950/70 dark:to-slate-900 shadow-xl shadow-emerald-600/15 dark:shadow-emerald-900/40 ring-4 ring-emerald-400/20 dark:ring-emerald-500/25"
      aria-label={t('contact.openChatsAriaLabel')}
    >
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-400/25 dark:bg-emerald-400/10 blur-2xl pointer-events-none" />
      <div className="relative p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-2xl text-white shadow-lg shadow-emerald-900/25"
            aria-hidden
          >
            💬
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
              </span>
              {t('contact.openChatsEyebrow')}
            </p>
            <h2 className="text-xl sm:text-2xl font-extrabold leading-tight text-emerald-950 dark:text-emerald-50">
              {title}
            </h2>
            <p className="text-sm font-medium text-emerald-900/85 dark:text-emerald-100/90">
              {t('contact.openChatsSubtitle')}
            </p>
          </div>
        </div>

        <ul className="space-y-3" role="list">
          {openRows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/chat?conv=${encodeURIComponent(row.id)}`}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border-2 border-emerald-600/35 dark:border-emerald-500/50 bg-white/95 dark:bg-slate-950/65 px-4 py-3.5 text-emerald-950 dark:text-emerald-50 shadow-md hover:bg-white dark:hover:bg-slate-900/85 hover:border-emerald-500 dark:hover:border-emerald-400 hover:scale-[1.01] transition-all"
              >
                <span className="text-base font-bold truncate">
                  {t('chat.conversationHistoryItemLabel', { n: row.id })}
                </span>
                <span className="flex flex-wrap items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold text-emerald-800/80 dark:text-emerald-200/90">
                    {formatActivity(row.last_message_at || row.created_at)}
                  </span>
                  <span className="text-xs font-extrabold uppercase tracking-wide px-3 py-1 rounded-full bg-emerald-600 text-white">
                    {t('chat.openConversationBadge')} →
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 border-t border-emerald-600/20 dark:border-emerald-400/20">
          <Link
            href="/chat?history=1"
            className="text-sm font-bold text-emerald-800 dark:text-emerald-200 underline-offset-4 hover:underline"
          >
            {t('contact.openChatsHistoryLink')}
          </Link>
        </div>
      </div>
    </section>
  )
}
