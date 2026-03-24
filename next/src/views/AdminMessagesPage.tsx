'use client'

import { useState, useEffect, useCallback } from 'react'
import { contactApi } from '@/api/contact'
import { useDebounce } from '@/hooks/useDebounce'

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  new:         { label: 'Nouveau',     color: 'bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300' },
  in_progress: { label: 'En cours',    color: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300' },
  done:        { label: 'Traité',      color: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300' },
  archived:    { label: 'Archivé',     color: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400' },
}

const PREF_LABEL: Record<string, string> = { visio: 'Visio', phone: 'Tél.', both: 'Visio / Tél.' }
const TYPE_LABEL: Record<string, string> = { rdv: 'RDV', question: 'Question', other: 'Autre' }

type ContactMessage = {
  id: number
  name?: string
  email?: string
  message?: string
  status?: string
  created_at?: string
  read_at?: string
  preference?: string
  request_type?: string
  coach_notes?: string
  _error?: string
}

type MessageList = { items: ContactMessage[]; total: number; pages: number }

function MessageDetailModal({ message: initial, onClose, onUpdate }: { message: ContactMessage; onClose: () => void; onUpdate: (m: ContactMessage) => void }) {
  const [msg, setMsg] = useState(initial)
  const [notes, setNotes] = useState(initial?.coach_notes ?? '')
  const [saving, setSaving] = useState(false)

  if (!msg) return null
  if (msg._error) return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl p-6 max-w-sm text-center border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
        <p className="text-rose-600 dark:text-rose-400">{msg._error}</p>
        <button onClick={onClose} className="mt-4 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm">Fermer</button>
      </div>
    </div>
  )

  async function updateStatus(status: string) {
    setSaving(true)
    try {
      const updated = await contactApi.update({ id: msg.id, status }) as ContactMessage
      setMsg(updated)
      onUpdate(updated)
    } catch {
      /* silent */
    }
    finally { setSaving(false) }
  }

  async function saveNotes() {
    setSaving(true)
    try {
      const updated = await contactApi.update({ id: msg.id, coach_notes: notes }) as ContactMessage
      setMsg(updated)
      onUpdate(updated)
    } catch {
      /* silent */
    }
    finally { setSaving(false) }
  }

  const sc = STATUS_CONFIG[msg.status ?? ''] ?? STATUS_CONFIG.new

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-40 flex items-start justify-center pt-6 px-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto mb-6 border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-[#0f172a] border-b border-slate-200 dark:border-slate-700 p-5 flex items-start justify-between z-10 rounded-t-2xl">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                {msg.name || msg.email}
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                {sc.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {formatDate(msg.created_at)} · {msg.email}
              {msg.preference && <span className="ml-2">· {PREF_LABEL[msg.preference] ?? msg.preference}</span>}
              {msg.request_type && <span className="ml-2">· {TYPE_LABEL[msg.request_type] ?? msg.request_type}</span>}
            </p>
          </div>
          <button onClick={onClose} className="ml-3 shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600">×</button>
        </div>

        <div className="p-5 space-y-5">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Message</p>
            <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line">{msg.message}</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Statut</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => updateStatus(key)}
                  disabled={saving || msg.status === key}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all disabled:opacity-50 ${
                    msg.status === key
                      ? cfg.color + ' border-transparent'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-violet-400 dark:hover:border-violet-600'
                  }`}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
              Notes internes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Notes visibles uniquement par l'équipe…"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 resize-none"
            />
            <button
              onClick={saveNotes}
              disabled={saving || notes === (initial?.coach_notes ?? '')}
              className="mt-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 disabled:opacity-40 transition-colors"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer les notes'}
            </button>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Répondre</p>
            <a
              href={`mailto:${msg.email}?subject=Re%3A%20Votre%20demande%20d%27accompagnement`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 text-sm font-medium hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors"
            >
              ✉️ Répondre par email
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminMessagesPage() {
  const [list, setList] = useState<MessageList | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState<ContactMessage | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  const debouncedSearch = useDebounce(search, 400)

  const loadList = useCallback(() => {
    setLoadingList(true)
    setListError(null)
    contactApi.list({ page, per_page: 20, search: debouncedSearch, status: statusFilter })
      .then((data) => setList(data as MessageList))
      .catch((err: { message?: string; detail?: string }) => {
        setList({ items: [], total: 0, pages: 0 })
        setListError(err?.message || (err?.detail as string) || 'Erreur lors du chargement')
      })
      .finally(() => setLoadingList(false))
  }, [page, debouncedSearch, statusFilter])

  useEffect(() => { loadList() }, [loadList])

  async function openDetail(id: number) {
    setLoadingDetail(true)
    setSelected(null)
    try {
      const r = await contactApi.get(String(id)) as ContactMessage
      setSelected(r)
      setList((prev) => prev ? { ...prev, items: prev.items.map((m) => (m.id === id ? { ...m, read_at: m.read_at || new Date().toISOString() } : m)) } : null)
    } catch (err: unknown) {
      const e = err as { message?: string; detail?: string }
      setSelected({ id: 0, _error: e?.message || (e?.detail as string) || 'Impossible de charger le détail' })
    } finally {
      setLoadingDetail(false)
    }
  }

  function handleUpdate(updated: ContactMessage) {
    setList((prev) => prev ? { ...prev, items: prev.items.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)) } : null)
    if (selected && selected.id === updated.id) setSelected((prev) => (prev ? { ...prev, ...updated } : null))
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-rose-500 bg-clip-text text-transparent">
        Messages &amp; Demandes
      </h2>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="text-[10px] text-slate-400 uppercase tracking-widest">Recherche email</label>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="email@exemple.com"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
            />
          </div>
          <div className="min-w-[160px]">
            <label className="text-[10px] text-slate-400 uppercase tracking-widest">Statut</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
            >
              <option value="">Tous</option>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>
          {list && (
            <span className="text-xs text-slate-400">{list.total} message{list.total !== 1 ? 's' : ''}</span>
          )}
          {listError && (
            <button onClick={loadList} className="text-xs text-rose-600 dark:text-rose-400 hover:underline">Réessayer</button>
          )}
        </div>

        {listError && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border-b border-rose-200 dark:border-rose-800 text-sm text-rose-700 dark:text-rose-300">
            {listError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800">
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Nom / Email</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Type</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Statut</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-widest"></th>
              </tr>
            </thead>
            <tbody>
              {loadingList ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <span className="inline-block w-6 h-6 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
                    <p className="text-sm text-slate-400 mt-2">Chargement…</p>
                  </td>
                </tr>
              ) : list?.items?.length ? (
                list.items.map((m) => {
                  const sc = STATUS_CONFIG[m.status ?? ''] ?? STATUS_CONFIG.new
                  const isUnread = !m.read_at
                  return (
                    <tr key={m.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(m.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isUnread && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" title="Non lu" />}
                          <div>
                            {m.name && <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{m.name}</p>}
                            <p className={`text-xs ${m.name ? 'text-slate-500' : 'text-sm text-slate-700 dark:text-slate-200'}`}>{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {TYPE_LABEL[m.request_type ?? ''] ?? m.request_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openDetail(m.id)}
                          disabled={loadingDetail}
                          className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                        >
                          Voir
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400 italic">
                    Aucun message trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {list && list.pages > 1 && (
          <div className="p-4 flex gap-2 justify-center border-t border-slate-100 dark:border-slate-800">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded-lg border text-sm disabled:opacity-40">←</button>
            <span className="px-3 py-1 text-sm text-slate-500">{page} / {list.pages}</span>
            <button disabled={page >= list.pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded-lg border text-sm disabled:opacity-40">→</button>
          </div>
        )}
      </div>

      {loadingDetail && !selected && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl p-6 flex flex-col items-center gap-3 border border-slate-200 dark:border-slate-700">
            <span className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Chargement…</p>
          </div>
        </div>
      )}

      {selected && (
        <MessageDetailModal
          message={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  )
}
