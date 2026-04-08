'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { chatApi } from '@/api/chat'
import { t } from '@/i18n'

type CoRow = {
  id: string
  status: string
  last_message_at: string | null
  last_message_sender_role?: string | null
  last_message_preview?: string | null
  assigned_coach_id?: number | null
  assigned_coach_display_name?: string | null
  created_at: string | null
}

function parseRows(r: unknown): CoRow[] {
  const data = r as {
    conversations?: Array<{
      id: string
      status?: string
      last_message_at?: string | null
      last_message_sender_role?: string | null
      last_message_preview?: string | null
      assigned_coach_id?: number | null
      assigned_coach_display_name?: string | null
      created_at?: string | null
    }>
  }
  const raw = data?.conversations ?? []
  return raw.map((c) => ({
    id: String(c.id),
    status: String(c.status ?? 'open'),
    last_message_at: c.last_message_at ? String(c.last_message_at) : null,
    last_message_sender_role:
      c.last_message_sender_role != null && String(c.last_message_sender_role).trim() !== ''
        ? String(c.last_message_sender_role).trim()
        : null,
    last_message_preview:
      c.last_message_preview != null && String(c.last_message_preview).trim() !== ''
        ? String(c.last_message_preview)
        : null,
    assigned_coach_id:
      c.assigned_coach_id != null && Number(c.assigned_coach_id) > 0 ? Number(c.assigned_coach_id) : null,
    assigned_coach_display_name:
      c.assigned_coach_display_name != null && String(c.assigned_coach_display_name).trim() !== ''
        ? String(c.assigned_coach_display_name).trim()
        : null,
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

function formatPreview(row: CoRow): string {
  const coachLabel =
    row.assigned_coach_id != null ? (row.assigned_coach_display_name || 'Accompagnant') : 'Équipe'
  const previewRaw = (row.last_message_preview || '').replace(/\s+/g, ' ').trim()
  const preview = previewRaw.length > 90 ? `${previewRaw.slice(0, 87)}…` : previewRaw
  const prefix =
    row.last_message_sender_role === 'user'
      ? 'Vous : '
      : row.last_message_sender_role
        ? 'Accompagnement : '
        : ''
  return preview ? `${coachLabel} · ${prefix}${preview}` : coachLabel
}

/**
 * Mon Jardin : accompagnement — conversations ouvertes visibles en premier, historique avec liens directs ?conv=
 */
export function DashboardCoachingChats() {
  const [rows, setRows] = useState<CoRow[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
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
  }, [])

  const sorted = useMemo(() => sortCoachingRows(rows), [rows])
  const openRows = useMemo(() => sorted.filter((r) => r.status === 'open'), [sorted])
  const historyRows = useMemo(() => sorted.filter((r) => r.status !== 'open'), [sorted])

  if (!loaded) {
    return (
      <div
        className="h-24 rounded-2xl bg-slate-200/40 dark:bg-slate-800/50 animate-pulse border border-slate-200/60 dark:border-slate-700/60"
        aria-hidden
      />
    )
  }

  if (rows.length === 0) {
    return (
      <Link
        href="/chat?history=1"
        className="block p-4 rounded-2xl border-2 border-violet-200 dark:border-violet-800 bg-violet-50/40 dark:bg-violet-950/25 hover:border-violet-400 dark:hover:border-violet-600 transition-colors"
      >
        <p className="text-sm font-medium text-violet-700 dark:text-violet-300">
          💬 {t('dashboard.chatHistoryTitle')}
        </p>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{t('dashboard.chatHistoryDesc')}</p>
      </Link>
    )
  }

  return (
    <div className="space-y-3">
      {openRows.length > 0 ? (
        <div className="rounded-2xl border-2 border-emerald-400/90 dark:border-emerald-500/80 bg-emerald-50/95 dark:bg-emerald-950/35 p-4 shadow-md ring-1 ring-emerald-500/25 dark:ring-emerald-400/20">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
            {t('dashboard.coachingOpenHeading')}
          </p>
          <ul className="mt-2 space-y-2">
            {openRows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/chat?conv=${encodeURIComponent(row.id)}`}
                  className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200/90 dark:border-emerald-700/80 bg-white/95 dark:bg-slate-900/70 px-3 py-2.5 text-emerald-950 dark:text-emerald-50 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:border-emerald-400 dark:hover:border-emerald-500 transition-colors"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold truncate">
                      {t('chat.conversationHistoryItemLabel', { n: row.id })}
                    </span>
                    <span className="block text-[11px] text-emerald-800/90 dark:text-emerald-200/90 mt-0.5 truncate">
                      {formatPreview(row)}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-white mt-0.5">
                    {t('chat.openConversationBadge')}
                  </span>
                </Link>
                <p className="text-[10px] text-emerald-700/90 dark:text-emerald-300/90 mt-1 px-1">
                  {formatActivity(row.last_message_at || row.created_at)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/50 p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            {t('dashboard.coachingHistorySection')}
          </h2>
          <Link
            href="/chat?history=1"
            className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline shrink-0"
          >
            {t('dashboard.coachingPickerLink')}
          </Link>
        </div>
        <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {historyRows.map((row) => {
            const closed = row.status === 'closed'
            return (
              <li key={`dash-co-${row.id}`}>
                <Link
                  href={`/chat?conv=${encodeURIComponent(row.id)}`}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                >
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                    {t('chat.conversationHistoryItemLabel', { n: row.id })}
                  </span>
                  <span className="shrink-0 text-[10px] text-slate-500 dark:text-slate-400">
                    {formatActivity(row.last_message_at || row.created_at)}
                  </span>
                  <span
                    className={`shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      closed
                        ? 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'
                        : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200'
                    }`}
                  >
                    {closed ? t('chat.closedConversationBadge') : t('chat.openConversationBadge')}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
