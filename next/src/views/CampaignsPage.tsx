'use client'

import { useEffect, useState } from 'react'
import { campaignsApi } from '@/api/campaigns'
import { toast } from '@/hooks/useToast'
import { FlowerSVG, scoresToPetals } from '@/components/FlowerSVG'

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 dark:bg-slate-800 text-slate-500',
  sent: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
  active: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300',
  closed: 'bg-slate-200 dark:bg-slate-700 text-slate-400',
  completed: 'bg-accent/10 text-accent',
}

const PETAL_LABELS: Record<string, string> = {
  agape:'Agapè', philautia:'Philautia', mania:'Mania',
  storge:'Storgè', pragma:'Pragma', philia:'Philia', ludus:'Ludus', eros:'Éros',
}

function normalizeScores(raw: Record<string, number> | null | undefined): Record<string, number> {
  if (!raw) return {}
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k.toLowerCase(), Number(v)])
  )
}

type Campaign = { id: number; definition_id: number; participant_count?: number; result_count?: number; status?: string; created_at?: string; participants?: { id: number; email?: string; status?: string }[] }
type Definition = { id: number; label?: string }
type ResultItem = { id: number; created_at?: string; payload?: { scores_participant1?: Record<string, number>; scores_participant2?: Record<string, number>; scores?: Record<string, number>; participant?: { email?: string }; participant1?: { email?: string }; participant2?: { email?: string }; image_url?: string } }

function ResultsPanel({ campaignId, onClose }: { campaignId: number; resultCount?: number; onClose: () => void }) {
  const [data, setData] = useState<{ results?: ResultItem[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    campaignsApi.results(String(campaignId))
      .then((d) => setData(d as { results?: ResultItem[] }))
      .catch(() => toast('Impossible de charger les résultats', 'error'))
      .finally(() => setLoading(false))
  }, [campaignId])

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh] space-y-5 border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg">Résultats de la campagne #{campaignId}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>

        {loading && <div className="text-center py-10 text-slate-400">Chargement…</div>}

        {!loading && (!data?.results || data.results.length === 0) && (
          <p className="text-slate-500 text-center py-8">Aucun résultat disponible pour cette campagne.</p>
        )}

        {!loading && data?.results?.map((r, idx) => {
          const p = r.payload ?? {}
          const s1 = normalizeScores(p.scores_participant1 ?? p.scores)
          const s2 = normalizeScores(p.scores_participant2)
          const hasDuo = Object.keys(s2).length > 0
          const duoScores = hasDuo
            ? Object.fromEntries(Object.keys(s1).map((k) => [k, ((s1[k] ?? 0) + (s2[k] ?? 0)) / 2]))
            : null

          return (
            <div key={r.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
              <div className="flex justify-between items-start flex-wrap gap-2">
                <p className="text-xs text-slate-500">
                  Résultat #{r.id} — {r.created_at?.slice(0, 16).replace('T', ' ')}
                </p>
                {p.image_url && (
                  <a href={p.image_url} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">
                    Voir la Fleur générée ↗
                  </a>
                )}
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                {(p.participant ?? p.participant1) && (
                  <span className="px-2 py-1 bg-accent/10 text-accent rounded-full">
                    A : {(p.participant ?? p.participant1)?.email ?? '—'}
                  </span>
                )}
                {p.participant2 && (
                  <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-full">
                    B : {p.participant2?.email ?? '—'}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap justify-center gap-6">
                <div className="text-center">
                  <p className="text-xs font-medium text-slate-500 mb-2">Participant A</p>
                  <FlowerSVG petals={scoresToPetals(s1)} size={180} animate showLabels />
                </div>
                {hasDuo && duoScores && (
                  <>
                    <div className="text-center">
                      <p className="text-xs font-medium text-slate-500 mb-2">Participant B</p>
                      <FlowerSVG petals={scoresToPetals(s2)} size={180} animate showLabels />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-medium text-slate-500 mb-2">DUO (moyenne)</p>
                      <FlowerSVG petals={scoresToPetals(duoScores)} size={180} animate showLabels />
                    </div>
                  </>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="py-1.5 text-left text-slate-500 font-semibold w-28">Pétale</th>
                      <th className="py-1.5 text-center text-accent font-semibold">{hasDuo ? 'Participant A' : 'Score'}</th>
                      {hasDuo && (
                        <>
                          <th className="py-1.5 text-center text-emerald-600 dark:text-emerald-400 font-semibold">Participant B</th>
                          <th className="py-1.5 text-center text-amber-500 font-semibold">DUO</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(PETAL_LABELS).map((p_key) => (
                      <tr key={p_key} className="border-b border-slate-50 dark:border-slate-800/50">
                        <td className="py-1.5 text-slate-600 dark:text-slate-300">{PETAL_LABELS[p_key]}</td>
                        <td className="py-1.5 text-center font-mono font-semibold text-accent">
                          {(s1[p_key] ?? 0).toFixed(2).replace(/\.00$/, '')}
                        </td>
                        {hasDuo && duoScores && (
                          <>
                            <td className="py-1.5 text-center font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                              {(s2[p_key] ?? 0).toFixed(2).replace(/\.00$/, '')}
                            </td>
                            <td className="py-1.5 text-center font-mono font-semibold text-amber-500">
                              {(duoScores[p_key] ?? 0).toFixed(2).replace(/\.00$/, '')}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [definitions, setDefinitions] = useState<Definition[]>([])
  const [selected, setSelected] = useState<Campaign | null>(null)
  const [resultsFor, setResultsFor] = useState<Campaign | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const [form, setForm] = useState({
    definition_id: '',
    recipient_emails: '',
    token_ttl_hours: 72,
  })

  function loadList() {
    campaignsApi.list({ page, per_page: 15 }).then((r) => {
      const data = r as { campaigns?: Campaign[]; total?: number }
      setCampaigns(data.campaigns ?? [])
      setTotal(data.total ?? 0)
    }).catch(() => toast('Erreur chargement', 'error'))
  }

  useEffect(() => {
    loadList()
    campaignsApi.definitions().then((d) => setDefinitions((d as { definitions?: Definition[] }).definitions ?? [])).catch(() => {})
  }, [page])

  async function openCampaign(id: number) {
    try {
      const r = (await campaignsApi.get(String(id))) as Campaign
      setSelected(r)
    } catch { toast('Erreur', 'error') }
  }

  async function createCampaign() {
    if (!form.definition_id) { toast('Choisissez une définition', 'error'); return }
    const emails = form.recipient_emails
      .split(/[\n,;]/)
      .map((e) => e.trim())
      .filter(Boolean)
    if (!emails.length) { toast('Ajoutez au moins un email', 'error'); return }
    setLoading(true)
    try {
      const res = (await campaignsApi.create({
        definition_id: parseInt(form.definition_id),
        recipient_emails: emails,
        token_ttl_hours: form.token_ttl_hours,
      })) as { tokens?: unknown[] }
      toast(`Campagne créée — ${res.tokens?.length ?? 0} token(s) générés`, 'success')
      setShowCreate(false)
      loadList()
    } catch (e) {
      toast('Erreur: ' + (e instanceof Error ? e.message : 'Erreur'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / 15))

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Campagnes rituelles</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-hover transition-colors"
        >
          + Nouvelle campagne
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              {['ID', 'Définition', 'Participants', 'Résultats', 'Statut', 'Créée', ''].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-4 py-2 font-mono text-xs">{c.id}</td>
                <td className="px-4 py-2 text-slate-600 dark:text-slate-300">Déf. #{c.definition_id}</td>
                <td className="px-4 py-2 text-center">{c.participant_count}</td>
                <td className="px-4 py-2 text-center">{c.result_count}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[c.status ?? 'draft'] ?? STATUS_BADGE.draft}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-400 text-xs">{c.created_at?.slice(0, 10)}</td>
                <td className="px-4 py-2">
                  <button onClick={() => openCampaign(c.id)} className="text-accent text-xs hover:underline">Détail</button>
                </td>
              </tr>
            ))}
            {!campaigns.length && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Aucune campagne</td></tr>
            )}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="p-3 flex gap-2 justify-center border-t border-slate-100 dark:border-slate-800">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded border text-sm disabled:opacity-40">←</button>
            <span className="px-3 py-1 text-sm text-slate-500">{page}/{totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded border text-sm disabled:opacity-40">→</button>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-40 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh] border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between mb-4">
              <h3 className="font-bold text-lg">Campagne #{selected.id}</h3>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              {selected.created_at?.slice(0, 10)} —{' '}
              <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_BADGE[selected.status ?? 'draft'] ?? ''}`}>
                {selected.status}
              </span>
            </p>

            <h4 className="font-semibold text-sm mb-2">Participants ({selected.participants?.length ?? 0})</h4>
            <div className="space-y-2 mb-5">
              {selected.participants?.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm border border-slate-100 dark:border-slate-800 rounded-lg px-3 py-2">
                  <span>{p.email || `Participant #${p.id}`}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[p.status ?? 'draft'] ?? STATUS_BADGE.draft}`}>
                    {p.status}
                  </span>
                </div>
              ))}
            </div>

            {(selected.result_count ?? 0) > 0 && (
              <button
                onClick={() => { setResultsFor(selected); setSelected(null) }}
                className="w-full py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-hover transition-colors"
              >
                Voir les résultats ({selected.result_count})
              </button>
            )}
          </div>
        </div>
      )}

      {resultsFor && (
        <ResultsPanel
          campaignId={resultsFor.id}
          resultCount={resultsFor.result_count}
          onClose={() => setResultsFor(null)}
        />
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-40 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between">
              <h3 className="font-bold text-lg">Nouvelle campagne</h3>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>

            <label className="block">
              <span className="text-sm text-slate-500">Définition de rituel</span>
              <select
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none"
                value={form.definition_id}
                onChange={(e) => setForm((f) => ({ ...f, definition_id: e.target.value }))}
              >
                <option value="">— Choisir —</option>
                {definitions.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="text-sm text-slate-500">Emails participants (un par ligne ou séparés par virgule)</span>
              <textarea
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none h-28 resize-none"
                placeholder="alice@email.com&#10;bob@email.com"
                value={form.recipient_emails}
                onChange={(e) => setForm((f) => ({ ...f, recipient_emails: e.target.value }))}
              />
            </label>

            <label className="block">
              <span className="text-sm text-slate-500">Validité des tokens (heures)</span>
              <input
                type="number" min={1} max={720}
                className="w-32 mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none"
                value={form.token_ttl_hours}
                onChange={(e) => setForm((f) => ({ ...f, token_ttl_hours: parseInt(e.target.value) || 72 }))}
              />
            </label>

            <div className="flex gap-3 pt-1">
              <button
                onClick={createCampaign}
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-accent text-white rounded-xl font-semibold text-sm hover:bg-accent-hover disabled:opacity-50 transition-colors"
              >
                {loading ? 'Création…' : 'Créer la campagne'}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
