'use client'

import { useEffect, useState } from 'react'
import { statsApi } from '@/api/stats'
import { toast } from '@/hooks/useToast'
import { FlowerSVG, scoresToPetals } from '@/components/FlowerSVG'
import { FLEUR_INTRO, FLEUR_COMMENT_LIRE, PETAL_INTERPRETATIONS, FLEUR_CONSEIL } from '@/data/fleurInterpretation'

const PETAL_LABELS: Record<string, string> = { agape:'Agapè', philautia:'Philautia', mania:'Mania', storge:'Storgè', pragma:'Pragma', philia:'Philia', ludus:'Ludus', eros:'Éros' }

function DataRow({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="text-slate-500 shrink-0 w-28">{label}</dt>
      <dd className={`text-slate-800 dark:text-slate-200 break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  )
}

function InterpretationSection({ scores }: { scores?: Record<string, number> }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-3 text-left flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Textes explicatifs</h4>
        <span className="text-slate-400 transition-transform" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-200 dark:border-slate-700 pt-4">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">{FLEUR_INTRO}</p>
          <div>
            <h5 className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">{FLEUR_COMMENT_LIRE.title}</h5>
            <ul className="list-disc list-inside text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
              {FLEUR_COMMENT_LIRE.points.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            {(['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'] as const).map((key) => {
              const def = PETAL_INTERPRETATIONS[key]
              const val = scores?.[key]
              return (
                <div key={key} className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 p-2.5">
                  <div className="flex items-baseline justify-between gap-2 mb-0.5">
                    <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">{def?.label}</span>
                    <span className="text-[10px] text-slate-500">{def?.subtitle}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{def?.description}</p>
                  {val !== undefined && <p className="mt-1 text-xs text-accent font-medium">Score : {val}</p>}
                </div>
              )
            })}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line border-t border-slate-200 dark:border-slate-600 pt-3">{FLEUR_CONSEIL}</p>
        </div>
      )}
    </section>
  )
}

type Overview = { total?: number; total_solo?: number; total_duo?: number; top_petals?: { petal?: string; count?: number }[] }
type Averages = { averages?: Record<string, number>; count?: number }
type ResultItem = { id: number; email?: string; is_duo?: boolean; created_at?: string }
type ResultsData = { results?: ResultItem[]; total?: number; pages?: number }
type SelectedDetail = ResultItem & { scores?: Record<string, number>; token?: string; intended_duo?: boolean; interpretation?: { summary?: string; insights?: string; reflection?: string }; partner?: { id?: number; email?: string; token?: string; created_at?: string }; duo_partner?: { id?: number; email?: string; token?: string; created_at?: string } }

export default function StatsPage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [averages, setAverages] = useState<Averages | null>(null)
  const [results, setResults] = useState<ResultsData | null>(null)
  const [selected, setSelected] = useState<SelectedDetail | null>(null)
  const [toDelete, setToDelete] = useState<ResultItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    statsApi.overview().then((d) => setOverview(d as Overview)).catch(() => toast('Erreur overview', 'error'))
    statsApi.averages().then((d) => setAverages(d as Averages)).catch(() => {})
  }, [])

  useEffect(() => {
    const params: Record<string, string | number | boolean> = { page, per_page: 20 }
    if (search) params.search = search
    if (filter === 'solo') params.solo_only = true
    if (filter === 'duo') params.duo_only = true
    statsApi.results(params).then((d) => setResults(d as ResultsData)).catch(() => toast('Erreur résultats', 'error'))
  }, [page, search, filter, refreshKey])

  function openDetail(id: number) {
    statsApi.detail(String(id)).then((d) => setSelected(d as SelectedDetail)).catch(() => toast('Erreur', 'error'))
  }

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await statsApi.delete(String(toDelete.id))
      toast(`Passation #${toDelete.id} supprimée`)
      setToDelete(null)
      setSelected(null)
      setRefreshKey(k => k + 1)
    } catch {
      toast('Erreur lors de la suppression', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Statistiques des passations</h2>

      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: overview.total, color: 'text-accent' },
            { label: 'Solo', value: overview.total_solo, color: 'text-slate-600 dark:text-slate-300' },
            { label: 'Duo', value: overview.total_duo, color: 'text-emerald-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-center">
              <div className={`text-3xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{label}</div>
            </div>
          ))}
          {overview.top_petals && overview.top_petals.length > 0 && (
            <div className="col-span-2 sm:col-span-1 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs font-semibold text-slate-500 mb-1">Top pétale dominant</p>
              <p className="text-lg font-bold text-accent">{PETAL_LABELS[overview.top_petals[0]?.petal ?? '']}</p>
              <p className="text-xs text-slate-400">{overview.top_petals[0]?.count} passations</p>
            </div>
          )}
        </div>
      )}

      {averages?.averages && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <h3 className="font-semibold mb-4">Profil moyen ({averages.count} passations)</h3>
          <div className="flex flex-col sm:flex-row gap-6 items-center">
            <FlowerSVG petals={scoresToPetals(averages.averages)} size={240} animate showLabels />
            <div className="grid grid-cols-2 gap-2 flex-1">
              {Object.entries(averages.averages).map(([p, v]) => (
                <div key={p} className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">{PETAL_LABELS[p]}</span>
                  <span className="font-bold font-mono">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap gap-3 items-center">
          <input
            className="flex-1 min-w-0 sm:w-48 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
            placeholder="Rechercher par email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
          <div className="flex gap-1">
            {[['', 'Tous'], ['solo', 'Solo'], ['duo', 'Duo']].map(([val, lbl]) => (
              <button key={val} onClick={() => { setFilter(val); setPage(1) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                  ${filter === val ? 'bg-accent text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
              >{lbl}</button>
            ))}
          </div>
          <span className="text-xs text-slate-400 ml-auto">{results?.total ?? '…'} résultats</span>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                {['ID', 'Email', 'Type', 'Date', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left font-semibold text-slate-500 text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results?.results?.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-2 font-mono text-xs">{r.id}</td>
                  <td className="px-4 py-2">{r.email || <span className="text-slate-400">—</span>}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.is_duo ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                      {r.is_duo ? 'Duo' : 'Solo'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-400 text-xs">{r.created_at?.slice(0, 10)}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      <button onClick={() => openDetail(r.id)} className="text-accent text-xs hover:underline">Détail</button>
                      <button onClick={() => setToDelete(r)} className="text-red-500 text-xs hover:underline" title="Supprimer">Suppr.</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-700">
          {results?.results?.map((r) => (
            <div key={r.id} className="p-4 flex flex-col gap-2">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs text-slate-500">#{r.id}</p>
                  <p className="font-medium text-slate-800 dark:text-slate-100 truncate">{r.email || '—'}</p>
                  <p className="text-xs text-slate-400">{r.created_at?.slice(0, 10)}</p>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${r.is_duo ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                  {r.is_duo ? 'Duo' : 'Solo'}
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openDetail(r.id)} className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20">Détail</button>
                <button onClick={() => setToDelete(r)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" title="Supprimer">Supprimer</button>
              </div>
            </div>
          ))}
        </div>

        {results && (results.pages ?? 1) > 1 && (
          <div className="p-4 flex gap-2 justify-center">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded-lg border text-sm disabled:opacity-40">←</button>
            <span className="px-3 py-1 text-sm text-slate-500">{page} / {results.pages}</span>
            <button disabled={page >= (results.pages ?? 1)} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-lg border text-sm disabled:opacity-40">→</button>
          </div>
        )}
      </div>

      {toDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !deleting && setToDelete(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg">Supprimer la passation ?</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Passation #{toDelete.id} — {toDelete.email || 'Anonyme'} ({toDelete.is_duo ? 'Duo' : 'Solo'}). Cette action est irréversible.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setToDelete(null)} disabled={deleting} className="px-4 py-2 rounded-lg text-sm border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50">
                Annuler
              </button>
              <button onClick={confirmDelete} disabled={deleting} className="px-4 py-2 rounded-lg text-sm bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <h3 className="font-bold text-lg">Passation #{selected.id}</h3>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>

            <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-800/30">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Données utilisateur</h4>
              <dl className="grid gap-1.5 text-sm">
                <DataRow label="ID" value={selected.id} mono />
                <DataRow label="Email" value={selected.email || '—'} />
                <DataRow label="Token" value={selected.token || '—'} mono />
                <DataRow label="Type" value={selected.is_duo ? 'Duo' : 'Solo'} />
                <DataRow label="Intended Duo" value={selected.intended_duo ? 'Oui' : 'Non'} />
                <DataRow label="Date" value={selected.created_at || '—'} />
              </dl>
            </section>

            <FlowerSVG petals={scoresToPetals(selected.scores ?? {})} size={240} animate showLabels />

            <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Scores</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {selected.scores && Object.entries(selected.scores).map(([p, v]) => (
                  <div key={p} className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-300">{PETAL_LABELS[p]}</span>
                    <span className="font-bold font-mono">{v}</span>
                  </div>
                ))}
              </div>
            </section>

            {selected.interpretation && (selected.interpretation.summary || selected.interpretation.insights || selected.interpretation.reflection) && (
              <section className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/30 p-4 space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">Interprétation personnalisée IA</h4>
                <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  {selected.interpretation.summary && <p className="leading-relaxed">{selected.interpretation.summary}</p>}
                  {selected.interpretation.insights && <p className="leading-relaxed italic">{selected.interpretation.insights}</p>}
                  {selected.interpretation.reflection && (
                    <p className="leading-relaxed text-violet-700 dark:text-violet-300 font-medium">{selected.interpretation.reflection}</p>
                  )}
                </div>
              </section>
            )}

            <InterpretationSection scores={selected.scores} />

            {(selected.partner || selected.duo_partner) && (
              <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Partenaire Duo</h4>
                {(selected.partner || selected.duo_partner) && (
                  <div className="rounded-lg bg-white dark:bg-slate-800 p-3 space-y-1.5">
                    <DataRow label="ID" value={(selected.partner || selected.duo_partner)!.id ?? ''} mono />
                    <DataRow label="Email" value={(selected.partner || selected.duo_partner)!.email || '—'} />
                    <DataRow label="Token" value={(selected.partner || selected.duo_partner)!.token || '—'} mono />
                    <DataRow label="Date" value={(selected.partner || selected.duo_partner)!.created_at || '—'} />
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
