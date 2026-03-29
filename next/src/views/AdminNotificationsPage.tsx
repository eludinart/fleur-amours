'use client'

import { useState, useEffect, useCallback } from 'react'
import { notificationsApi } from '@/api/notifications'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/contexts/NotificationContext'
import { toast } from '@/hooks/useToast'

const TYPES = [
  { value: '', label: 'Tous les types' },
  { value: 'admin_announcement', label: 'Annonce' },
  { value: 'targeted', label: 'Ciblée' },
  { value: 'chat_message', label: 'Chat (coach→user)' },
  { value: 'chat_new_message', label: 'Chat (user→coach)' },
  { value: 'contact_reply', label: 'Réponse contact' },
  { value: 'system', label: 'Système' },
]

const RECIPIENT_TYPES = [
  { value: 'all', label: 'Tous les utilisateurs' },
  { value: 'role', label: 'Par rôle' },
  { value: 'user', label: 'Utilisateur spécifique' },
]

const PRIORITIES = [
  { value: 'low', label: 'Basse', color: 'bg-slate-100 text-slate-600' },
  { value: 'normal', label: 'Normale', color: 'bg-blue-100 text-blue-700' },
  { value: 'high', label: 'Haute', color: 'bg-amber-100 text-amber-700' },
  { value: 'urgent', label: 'Urgente', color: 'bg-rose-100 text-rose-700' },
]

function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function StatCard({ label, value, color = 'text-slate-800 dark:text-slate-100' }: { label: string; value?: number; color?: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value ?? '—'}</p>
    </div>
  )
}

type FormState = {
  type: string
  title: string
  body: string
  action_url: string
  action_label: string
  recipient_type: string
  recipient_id: string
  recipient_email: string
  recipient_role: string
  priority: string
  expires_at: string
}

export default function AdminNotificationsPage() {
  const { user } = useAuth()
  const { fetchUnread } = useNotifications()
  const [tab, setTab] = useState('list')
  const [testing, setTesting] = useState(false)
  const [stats, setStats] = useState<{
    total?: number
    delivered?: number
    read?: number
    unread?: number
    unread_mine?: number
  } | null>(null)
  const [list, setList] = useState<{ items: unknown[]; total?: number; pages?: number } | null>(null)
  const [page, setPage] = useState(1)
  const [filterType, setFilterType] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [deleting, setDeleting] = useState(false)

  const [form, setForm] = useState<FormState>({
    type: 'admin_announcement',
    title: '',
    body: '',
    action_url: '',
    action_label: '',
    recipient_type: 'all',
    recipient_id: '',
    recipient_email: '',
    recipient_role: 'user',
    priority: 'normal',
    expires_at: '',
  })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState('')

  const fetchStats = useCallback(async () => {
    try {
      const data = await notificationsApi.stats() as {
        total?: number
        delivered?: number
        read?: number
        unread?: number
        unread_mine?: number
      }
      setStats(data)
    } catch {
      /* silent */
    }
  }, [])

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page, per_page: 20 }
      if (filterType) params.type = filterType
      const data = await notificationsApi.adminList(params) as { items?: unknown[]; total?: number; pages?: number }
      setList({ items: data.items ?? [], total: data.total, pages: data.pages })
    } catch {
      /* silent */
    }
    setLoading(false)
  }, [page, filterType])

  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => { fetchList() }, [fetchList])
  useEffect(() => { setSelectedIds(new Set()) }, [filterType])

  const items = (list?.items ?? []) as { id: number }[]
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
    if (allOnPageSelected) setSelectedIds((prev) => { const n = new Set(prev); items.forEach((i) => n.delete(i.id)); return n })
    else setSelectedIds((prev) => { const n = new Set(prev); items.forEach((i) => n.add(i.id)); return n })
  }
  const handleDeleteSelected = async () => {
    if (!someSelected) return
    if (!window.confirm(`Supprimer ${selectedIds.size} notification(s) ?`)) return
    setDeleting(true)
    try {
      const ids = Array.from(selectedIds).map(Number).filter(Boolean)
      const res = await notificationsApi.adminDelete({ ids }) as { deleted?: number }
      setSelectedIds(new Set())
      fetchStats()
      fetchList()
      toast(`${res?.deleted ?? ids.length} notification(s) supprimée(s)`, 'success')
    } catch (err: unknown) {
      const e = err as { message?: string }
      toast(e?.message || 'Erreur lors de la suppression', 'error')
    }
    setDeleting(false)
  }
  const handleDeleteByFilters = async () => {
    const filters = filterType ? { type: filterType } : {}
    const total = list?.total ?? 0
    if (filterType) {
      const typeLabel = TYPES.find((t) => t.value === filterType)?.label || filterType
      if (!window.confirm(`Supprimer toutes les notifications de type « ${typeLabel} » ? (${total} au total)`)) return
    } else {
      if (!window.confirm(`Supprimer TOUTES les ${total} notifications ? Cette action est irréversible.`)) return
    }
    setDeleting(true)
    try {
      const res = await notificationsApi.adminDelete({ filters }) as { deleted?: number }
      setSelectedIds(new Set())
      fetchStats()
      fetchList()
      toast(`${res?.deleted ?? 0} notification(s) supprimée(s)`, 'success')
    } catch (err: unknown) {
      const e = err as { message?: string }
      toast(e?.message || 'Erreur lors de la suppression', 'error')
    }
    setDeleting(false)
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    setSendError('')
    setSent(false)
    try {
      const payload: Record<string, unknown> = {
        type: form.type,
        title: form.title,
        body: form.body || null,
        action_url: form.action_url || null,
        action_label: form.action_label || null,
        recipient_type: form.recipient_type,
        priority: form.priority,
        expires_at: form.expires_at || null,
        created_by: (user as { id?: number })?.id,
      }
      if (form.recipient_type === 'user') {
        if (form.recipient_id) payload.recipient_id = parseInt(form.recipient_id)
        if (form.recipient_email) payload.recipient_email = form.recipient_email
      }
      if (form.recipient_type === 'role') {
        payload.recipient_role = form.recipient_role
      }
      await notificationsApi.create(payload)
      setSent(true)
      setForm((f) => ({ ...f, title: '', body: '', action_url: '', action_label: '', recipient_id: '', recipient_email: '', expires_at: '' }))
      fetchStats()
      fetchList()
    } catch (err: unknown) {
      const e = err as { message?: string }
      setSendError(e?.message || "Erreur lors de l'envoi")
    }
    setSending(false)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">Gérer et envoyer des notifications aux utilisateurs</p>
        </div>
        <button
          onClick={async () => {
            setTesting(true)
            try {
              await notificationsApi.test()
              fetchUnread()
            } catch {
              /* silent */
            }
            setTesting(false)
          }}
          disabled={testing}
          className="shrink-0 px-4 py-2 rounded-lg border border-violet-300 dark:border-violet-700 text-sm font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30 disabled:opacity-50"
        >
          {testing ? '…' : 'Notification de test'}
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="Total envoyées" value={stats.total} />
          <StatCard label="Délivrées" value={stats.delivered} />
          <StatCard label="Lues" value={stats.read} color="text-emerald-600" />
          <StatCard
            label="Non lues (tous comptes)"
            value={stats.unread}
            color="text-rose-500"
          />
          <StatCard
            label="Ma cloche"
            value={stats.unread_mine}
            color="text-amber-600"
          />
        </div>
      )}

      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
        {[
          { id: 'list', label: 'Historique' },
          { id: 'compose', label: 'Nouvelle notification' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors
              ${tab === t.id ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'list' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setPage(1) }}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            >
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {someSelected && (
              <button
                onClick={handleDeleteSelected}
                disabled={deleting}
                className="px-3 py-1.5 text-sm rounded-lg bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
              >
                {deleting ? '…' : `Supprimer (${selectedIds.size})`}
              </button>
            )}
            <button
              onClick={handleDeleteByFilters}
              disabled={deleting || (list?.total ?? 0) === 0}
              className="px-3 py-1.5 text-sm rounded-lg border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-50"
              title={filterType ? `Supprimer toutes les notifications de type « ${TYPES.find((t) => t.value === filterType)?.label} »` : 'Supprimer toutes les notifications'}
            >
              {deleting ? '…' : (filterType ? 'Tout supprimer (filtre)' : 'Tout supprimer')}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800">
                  <th className="px-4 py-3 w-10">
                    <input
                      ref={(el) => { if (el) (el as HTMLInputElement).indeterminate = someOnPageSelected && !allOnPageSelected }}
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleSelectAllPage}
                      className="rounded border-slate-300 dark:border-slate-600"
                      title="Tout sélectionner (page)"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Type</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Titre</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Cible</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Priorité</th>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Lues/Envoyées</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center">
                    <span className="inline-block w-6 h-6 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
                  </td></tr>
                ) : items.length > 0 ? items.map((n: { id: number; created_at?: string; type?: string; title?: string; recipient_type?: string; recipient_role?: string; recipient_email?: string; recipient_id?: number; priority?: string; read_count?: number; delivery_count?: number }) => {
                  const prio = PRIORITIES.find((p) => p.value === n.priority) || PRIORITIES[1]
                  const typeLabel = TYPES.find((t) => t.value === n.type)?.label || n.type
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
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200 truncate max-w-[200px]">{n.title || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {n.recipient_type === 'all' ? 'Tous' :
                         n.recipient_type === 'role' ? `Rôle: ${n.recipient_role}` :
                         n.recipient_email || `#${n.recipient_id}`}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${prio.color}`}>{prio.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs">
                        <span className="text-emerald-600 font-medium">{n.read_count}</span>
                        <span className="text-slate-400">/{n.delivery_count}</span>
                      </td>
                    </tr>
                  )
                }) : (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400 italic">Aucune notification</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {list && (list.pages ?? 1) > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="text-xs text-violet-600 hover:underline disabled:opacity-30"
              >← Précédent</button>
              <span className="text-xs text-slate-400">Page {page} / {list.pages}</span>
              <button
                disabled={page >= (list.pages ?? 1)}
                onClick={() => setPage((p) => p + 1)}
                className="text-xs text-violet-600 hover:underline disabled:opacity-30"
              >Suivant →</button>
            </div>
          )}
        </div>
      )}

      {tab === 'compose' && (
        <form onSubmit={handleSend} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
          {sent && (
            <div className="px-4 py-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm">
              Notification envoyée avec succès.
            </div>
          )}
          {sendError && (
            <div className="px-4 py-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm">
              {sendError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="admin_announcement">Annonce générale</option>
                <option value="targeted">Notification ciblée</option>
                <option value="system">Notification système</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Priorité</label>
              <div className="flex gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, priority: p.value }))}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors
                      ${form.priority === p.value ? p.color + ' border-current' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Titre *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
              placeholder="Titre de la notification"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Message</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              rows={3}
              placeholder="Contenu détaillé (optionnel)"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 resize-y"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Lien d&apos;action (URL)</label>
              <input
                type="text"
                value={form.action_url}
                onChange={(e) => setForm((f) => ({ ...f, action_url: e.target.value }))}
                placeholder="/chat, /session, etc."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Libellé du bouton</label>
              <input
                type="text"
                value={form.action_label}
                onChange={(e) => setForm((f) => ({ ...f, action_label: e.target.value }))}
                placeholder="Voir, Ouvrir, etc."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          <fieldset className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3">
            <legend className="text-xs font-semibold text-slate-500 px-2">Ciblage</legend>

            <div className="flex gap-2">
              {RECIPIENT_TYPES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, recipient_type: r.value }))}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors
                    ${form.recipient_type === r.value
                      ? 'bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 border-violet-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {form.recipient_type === 'user' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">ID utilisateur</label>
                  <input
                    type="number"
                    value={form.recipient_id}
                    onChange={(e) => setForm((f) => ({ ...f, recipient_id: e.target.value }))}
                    placeholder="ex: 42"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">ou Email</label>
                  <input
                    type="email"
                    value={form.recipient_email}
                    onChange={(e) => setForm((f) => ({ ...f, recipient_email: e.target.value }))}
                    placeholder="user@example.com"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
            )}

            {form.recipient_type === 'role' && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">Rôle cible</label>
                <select
                  value={form.recipient_role}
                  onChange={(e) => setForm((f) => ({ ...f, recipient_role: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="user">Utilisateurs</option>
                  <option value="admin">Administrateurs</option>
                </select>
              </div>
            )}
          </fieldset>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Date d&apos;expiration (optionnel)</label>
            <input
              type="datetime-local"
              value={form.expires_at}
              onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          <button
            type="submit"
            disabled={sending || !form.title}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {sending ? 'Envoi…' : 'Envoyer la notification'}
          </button>
        </form>
      )}
    </div>
  )
}
