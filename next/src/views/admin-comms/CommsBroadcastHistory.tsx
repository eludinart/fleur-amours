'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from '@/hooks/useToast'
import { api } from '@/lib/api-client'

type BroadcastRow = {
  id: number
  title: string
  status: string
  created_at?: string | null
  channels?: { email?: unknown; inapp?: unknown } | null
}

function channelLabel(row: BroadcastRow): string {
  try {
    const ch = row.channels
    const hasEmail = !!ch?.email
    const hasInapp = !!ch?.inapp
    if (hasEmail && hasInapp) return 'E-mail + notif'
    if (hasEmail) return 'E-mail'
    if (hasInapp) return 'Notification'
    return '—'
  } catch {
    return '—'
  }
}

const STATUS_STYLES: Record<string, string> = {
  sent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  failed: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  sending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
}

export function CommsBroadcastHistory() {
  const [history, setHistory] = useState<{ items: BroadcastRow[]; total: number } | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = (await api.get('/api/admin/broadcasts/list?page=1&per_page=40')) as {
        items?: BroadcastRow[]
        total?: number
      }
      setHistory({ items: data.items ?? [], total: data.total ?? 0 })
    } catch {
      toast('Impossible de charger l\'historique', 'error')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Campagnes envoyées</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {history ? `${history.total} diffusion(s) — e-mails et notifications groupées` : '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? '…' : 'Rafraîchir'}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/80">
            <tr>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">ID</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Titre</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Canal</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Statut</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Créée</th>
            </tr>
          </thead>
          <tbody>
            {loading && !history ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  Chargement…
                </td>
              </tr>
            ) : (history?.items.length ?? 0) > 0 ? (
              history!.items.map((b) => (
                <tr key={b.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{b.id}</td>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{b.title}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {channelLabel(b)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        STATUS_STYLES[b.status] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-800'
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                    {b.created_at ? new Date(b.created_at).toLocaleString('fr-FR') : '—'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400 italic">
                  Aucune campagne pour l&apos;instant
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
