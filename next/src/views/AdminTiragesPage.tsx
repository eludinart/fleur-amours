'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { tarotReadingsApi } from '@/api/tarotReadings'
import { TranslatableContent } from '@/components/TranslatableContent'
import { useDebounce } from '@/hooks/useDebounce'

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

type TarotCard = { name: string; img?: string; desc?: string }

type Reading = {
  id: number
  type: string
  email?: string
  createdAt?: string
  card?: TarotCard
  cards?: TarotCard[]
  synthesis?: string
  reflection?: string
  _error?: string
}

type ReadingList = { items: Reading[]; total: number; pages: number }

function ReadingDetailModal({ reading, onClose }: { reading: Reading; onClose: () => void }) {
  if (!reading) return null

  if (reading._error) {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-40 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl p-6 max-w-sm text-center border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
          <p className="text-rose-600 dark:text-rose-400">{reading._error}</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm">Fermer</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-40 flex items-start justify-center pt-8 px-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 p-5 flex items-center justify-between z-10 rounded-t-2xl">
          <div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Tirage #{reading.id}</h3>
            <p className="text-xs text-slate-500 mt-1">
              {formatDate(reading.createdAt)} · {reading.type === 'simple' ? 'Tirage simple' : '4 Portes'}
              {reading.email && <span className="ml-2">· {reading.email}</span>}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600">×</button>
        </div>

        <div className="p-5 space-y-4">
          {reading.type === 'simple' && reading.card && (
            <>
              {reading.card.img && (
                <div className="flex justify-center">
                  <img src={reading.card.img} alt={reading.card.name} className="w-32 h-48 object-contain rounded-xl border border-slate-200 dark:border-slate-600 shadow-md" onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }} />
                </div>
              )}
              <h4 className="text-lg font-bold text-violet-600 dark:text-violet-400">{reading.card.name}</h4>
              <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">{reading.card.desc}</p>
            </>
          )}

          {reading.type === 'four' && reading.cards?.length && reading.cards.length > 0 && (
            <>
              <div className="flex flex-wrap justify-center gap-3">
                {reading.cards.map((c, i) => (
                  <div key={i} className="flex flex-col items-center">
                    {c.img && (
                      <img src={c.img} alt={c.name} className="w-20 h-28 object-contain rounded-lg border border-slate-200 dark:border-slate-600 shadow" onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }} />
                    )}
                    <span className="mt-1 px-2 py-0.5 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-xs font-medium text-violet-700 dark:text-violet-300 text-center max-w-[80px] truncate">{c.name}</span>
                  </div>
                ))}
              </div>
              {reading.synthesis && (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Synthèse</p>
                  <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line">{reading.synthesis}</p>
                </div>
              )}
            </>
          )}

          {reading.reflection && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 p-4">
              <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-2">Réflexion</p>
              <TranslatableContent text={reading.reflection} className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line" as="p" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminTiragesPage() {
  const [list, setList] = useState<ReadingList | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Reading | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  const debouncedSearch = useDebounce(search, 400)

  const loadList = useCallback(() => {
    setLoadingList(true)
    setListError(null)
    tarotReadingsApi.list({ page, per_page: 20, search: debouncedSearch || undefined })
      .then((data) => {
        setList(data as ReadingList)
        setListError(null)
      })
      .catch((err: { message?: string; detail?: string }) => {
        setList({ items: [], total: 0, pages: 0 })
        setListError(err?.message || (err?.detail as string) || 'Erreur lors du chargement des tirages')
      })
      .finally(() => setLoadingList(false))
  }, [page, debouncedSearch])

  useEffect(() => { loadList() }, [loadList])

  async function openDetail(id: number) {
    setLoadingDetail(true)
    setSelected(null)
    try {
      const r = await tarotReadingsApi.get(String(id))
      setSelected(r as Reading)
    } catch (err: unknown) {
      const e = err as { message?: string; detail?: string }
      setSelected({ id: 0, type: '', _error: e?.message || (e?.detail as string) || 'Impossible de charger le détail' })
    }
    finally { setLoadingDetail(false) }
  }

  function summary(r: Reading) {
    if (r.type === 'simple') return r.card?.name ?? '—'
    if (r.type === 'four' && r.cards?.length) return r.cards.map((c) => c.name).join(' · ')
    return '—'
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-rose-500 bg-clip-text text-transparent">
        <Link href="/admin" className="hover:opacity-80">Admin</Link>
        <span className="mx-2">/</span>
        Tirages
      </h2>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="text-[10px] text-slate-400 uppercase tracking-widest">Recherche email</label>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="email@exemple.com"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
            />
          </div>
          {list && (
            <span className="text-xs text-slate-400">{list.total} tirage{list.total !== 1 ? 's' : ''}</span>
          )}
          {listError && (
            <button onClick={loadList} className="text-xs text-rose-600 dark:text-rose-400 hover:underline">
              Réessayer
            </button>
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
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Email</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Type</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Résumé</th>
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
                list.items.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(r.createdAt)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{r.email || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.type === 'four' ? 'bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                        {r.type === 'simple' ? 'Simple' : '4 Portes'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200 truncate max-w-[200px]">{summary(r)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openDetail(r.id)} disabled={loadingDetail} className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline">
                        Détail
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400 italic">
                    Aucun tirage trouvé.
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
            <p className="text-sm text-slate-500">Chargement du détail…</p>
          </div>
        </div>
      )}
      {selected && <ReadingDetailModal reading={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
