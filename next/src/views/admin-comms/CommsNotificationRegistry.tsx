'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { notificationsApi } from '@/api/notifications'
import { toast } from '@/hooks/useToast'
import { SortableTh } from '@/components/SortableTh'
import { useTableSort } from '@/hooks/useTableSort'

const TYPES = [
  { value: '', label: 'Tous les types' },
  { value: 'admin_announcement', label: 'Annonce' },
  { value: 'targeted', label: 'Ciblée' },
  { value: 'chat_message', label: 'Chat (coach→user)' },
  { value: 'chat_new_message', label: 'Chat (user→coach)' },
  { value: 'contact_reply', label: 'Réponse contact' },
  { value: 'system', label: 'Système' },
  { value: 'checkin_reminder', label: 'Relance check-in' },
  { value: 'plan14j_reminder', label: 'Relance plan 14j' },
  { value: 'engagement_tirage', label: 'Relance tirage' },
  { value: 'engagement_fleur', label: 'Relance Fleur' },
  { value: 'engagement_session', label: 'Relance session' },
  { value: 'engagement_dreamscape', label: 'Relance dreamscape' },
  { value: 'engagement_comeback', label: 'Retour au jardin (15 j)' },
]

const PRIORITIES = [
  { value: 'low', label: 'Basse', color: 'bg-slate-100 text-slate-600' },
  { value: 'normal', label: 'Normale', color: 'bg-blue-100 text-blue-700' },
  { value: 'high', label: 'Haute', color: 'bg-amber-100 text-amber-700' },
  { value: 'urgent', label: 'Urgente', color: 'bg-rose-100 text-rose-700' },
]

function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type NotificationRow = {
  id: number
  created_at?: string
  type?: string
  title?: string
  recipient_type?: string
  recipient_role?: string
  recipient_email?: string
  recipient_id?: number
  priority?: string
  read_count?: number
  delivery_count?: number
  channels?: { inapp?: boolean; email?: boolean }
  send_status?: 'ok' | 'partial' | 'error' | 'pending' | 'inapp_only' | 'untracked'
  email_sent_count?: number
  email_failed_count?: number
  email_error?: string | null
}

function channelLabel(n: NotificationRow): string {
  const inapp = n.channels?.inapp !== false
  const email = !!n.channels?.email
  if (email && inapp) return 'E-mail + notif'
  if (email) return 'E-mail'
  if (inapp) return 'Notification'
  return '—'
}

const SEND_STATUS_STYLES: Record<string, string> = {
  ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  inapp_only: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  error: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  pending: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  untracked: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
}

function sendStatusLabel(n: NotificationRow): string {
  const st = n.send_status ?? 'inapp_only'
  const inapp = n.channels?.inapp !== false
  const email = !!n.channels?.email
  if (st === 'ok') {
    if (email && inapp) return 'Envoyé'
    if (email) return 'E-mail OK'
    return 'Notif OK'
  }
  if (st === 'inapp_only') return 'Notif OK'
  if (st === 'partial') return `Partiel (${n.email_failed_count ?? 0} err.)`
  if (st === 'error') return 'Erreur'
  if (st === 'pending') return 'En attente'
  if (st === 'untracked') return inapp ? 'Notif OK · e-mail non tracé' : 'Non tracé'
  return '—'
}

function sendStatusTitle(n: NotificationRow): string | undefined {
  if (n.email_error) return n.email_error
  if (n.send_status === 'untracked') return 'Envoi antérieur à la journalisation e-mail'
  if (n.send_status === 'pending') return 'E-mail en cours ou non encore journalisé'
  return undefined
}

function recipientSortLabel(n: NotificationRow): string {
  if (n.recipient_type === 'all') return 'Tous'
  if (n.recipient_type === 'role') return `Rôle: ${n.recipient_role}`
  return n.recipient_email || `#${n.recipient_id}`
}

type Props = {
  onStatsChange?: () => void
}

export function CommsNotificationRegistry({ onStatsChange }: Props) {
  const [list, setList] = useState<{ items: unknown[]; total?: number; pages?: number } | null>(null)
  const [page, setPage] = useState(1)
  const [filterType, setFilterType] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [deleting, setDeleting] = useState(false)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page, per_page: 20 }
      if (filterType) params.type = filterType
      const data = (await notificationsApi.adminList(params)) as {
        items?: unknown[]
        total?: number
        pages?: number
      }
      setList({ items: data.items ?? [], total: data.total, pages: data.pages })
    } catch {
      /* silent */
    }
    setLoading(false)
  }, [page, filterType])

  useEffect(() => {
    fetchList()
  }, [fetchList])
  useEffect(() => {
    setSelectedIds(new Set())
  }, [filterType])

  const items = (list?.items ?? []) as NotificationRow[]
  const notificationSortAccessors = useMemo(
    () => ({
      created_at: (n: NotificationRow) => n.created_at || '',
      type: (n: NotificationRow) => n.type || '',
      title: (n: NotificationRow) => (n.title || '').toLowerCase(),
      recipient: (n: NotificationRow) => recipientSortLabel(n).toLowerCase(),
      priority: (n: NotificationRow) => n.priority || '',
      channel: (n: NotificationRow) => channelLabel(n).toLowerCase(),
      send_status: (n: NotificationRow) => n.send_status || '',
      reads: (n: NotificationRow) => n.read_count ?? 0,
    }),
    [],
  )
  const { sortedItems: sortedNotifications, sortKey, sortDir, toggleSort } = useTableSort(
    items,
    notificationSortAccessors,
    { defaultKey: 'created_at', defaultDir: 'desc' },
  )
  const allOnPageSelected = items.length > 0 && items.every((n) => selectedIds.has(n.id))
  const someOnPageSelected = items.some((n) => selectedIds.has(n.id))
  const someSelected = selectedIds.size > 0

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllPage = () => {
    if (allOnPageSelected) {
      setSelectedIds((prev) => {
        const n = new Set(prev)
        items.forEach((i) => n.delete(i.id))
        return n
      })
    } else {
      setSelectedIds((prev) => {
        const n = new Set(prev)
        items.forEach((i) => n.add(i.id))
        return n
      })
    }
  }

  const handleDeleteSelected = async () => {
    if (!someSelected) return
    if (!window.confirm(`Supprimer ${selectedIds.size} notification(s) ?`)) return
    setDeleting(true)
    try {
      const ids = Array.from(selectedIds).map(Number).filter(Boolean)
      const res = (await notificationsApi.adminDelete({ ids })) as { deleted?: number }
      setSelectedIds(new Set())
      fetchList()
      onStatsChange?.()
      toast(`${res?.deleted ?? ids.length} notification(s) supprimée(s)`, 'success')
    } catch (err: unknown) {
      toast((err as { message?: string })?.message || 'Erreur suppression', 'error')
    }
    setDeleting(false)
  }

  const handleDeleteByFilters = async () => {
    const filters = filterType ? { type: filterType } : {}
    const total = list?.total ?? 0
    if (filterType) {
      const typeLabel = TYPES.find((t) => t.value === filterType)?.label || filterType
      if (!window.confirm(`Supprimer toutes les notifications « ${typeLabel} » ? (${total})`)) return
    } else if (!window.confirm(`Supprimer TOUTES les ${total} notifications ? Irréversible.`)) return
    setDeleting(true)
    try {
      const res = (await notificationsApi.adminDelete({ filters })) as { deleted?: number }
      setSelectedIds(new Set())
      fetchList()
      onStatsChange?.()
      toast(`${res?.deleted ?? 0} notification(s) supprimée(s)`, 'success')
    } catch (err: unknown) {
      toast((err as { message?: string })?.message || 'Erreur suppression', 'error')
    }
    setDeleting(false)
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Registre des notifications</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Journal détaillé — canal (e-mail / notification), statut d&apos;envoi et taux de lecture
        </p>
      </div>
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
        <select
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value)
            setPage(1)
          }}
          className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        {someSelected && (
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={deleting}
            className="px-3 py-1.5 text-sm rounded-lg bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
          >
            {deleting ? '…' : `Supprimer (${selectedIds.size})`}
          </button>
        )}
        <button
          type="button"
          onClick={handleDeleteByFilters}
          disabled={deleting || (list?.total ?? 0) === 0}
          className="px-3 py-1.5 text-sm rounded-lg border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-50"
        >
          {deleting ? '…' : filterType ? 'Tout supprimer (filtre)' : 'Tout supprimer'}
        </button>
        <span className="text-xs text-slate-400 ml-auto">{list?.total ?? 0} entrée(s)</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/80">
              <th className="px-4 py-3 w-10">
                <input
                  ref={(el) => {
                    if (el) (el as HTMLInputElement).indeterminate = someOnPageSelected && !allOnPageSelected
                  }}
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleSelectAllPage}
                  className="rounded border-slate-300 dark:border-slate-600"
                />
              </th>
              <SortableTh columnKey="created_at" label="Date" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh columnKey="type" label="Type" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh columnKey="channel" label="Canal" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh columnKey="title" label="Titre" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh columnKey="recipient" label="Cible" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh columnKey="priority" label="Priorité" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh columnKey="send_status" label="Envoi" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh columnKey="reads" label="Lues/Envoyées" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center">
                  <span className="inline-block w-6 h-6 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
                </td>
              </tr>
            ) : sortedNotifications.length > 0 ? (
              sortedNotifications.map(
                (n) => {
                  const prio = PRIORITIES.find((p) => p.value === n.priority) || PRIORITIES[1]
                  const typeLabel = TYPES.find((t) => t.value === n.type)?.label || n.type
                  const statusKey = n.send_status ?? 'inapp_only'
                  const statusStyle = SEND_STATUS_STYLES[statusKey] ?? SEND_STATUS_STYLES.pending
                  return (
                    <tr key={n.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(n.id)}
                          onChange={() => toggleSelect(n.id)}
                          className="rounded border-slate-300 dark:border-slate-600"
                        />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(n.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {typeLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {channelLabel(n)}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200 truncate max-w-[200px]">{n.title || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {n.recipient_type === 'all'
                          ? 'Tous'
                          : n.recipient_type === 'role'
                            ? `Rôle: ${n.recipient_role}`
                            : n.recipient_email || `#${n.recipient_id}`}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${prio.color}`}>{prio.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${statusStyle}`}
                          title={sendStatusTitle(n)}
                        >
                          {sendStatusLabel(n)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs">
                        <span className="text-emerald-600 font-medium">{n.read_count}</span>
                        <span className="text-slate-400">/{n.delivery_count}</span>
                      </td>
                    </tr>
                  )
                },
              )
            ) : (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-400 italic">
                  Aucune notification
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {list && (list.pages ?? 1) > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="text-xs text-violet-600 hover:underline disabled:opacity-30"
          >
            ← Précédent
          </button>
          <span className="text-xs text-slate-400">
            Page {page} / {list.pages}
          </span>
          <button
            type="button"
            disabled={page >= (list.pages ?? 1)}
            onClick={() => setPage((p) => p + 1)}
            className="text-xs text-violet-600 hover:underline disabled:opacity-30"
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  )
}
