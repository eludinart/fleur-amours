'use client'

import { useEffect, useMemo, useState } from 'react'
import { telemetryApi, type TelemetryEventItem } from '@/api/telemetry'

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function formatTs(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v ?? {}, null, 2)
  } catch {
    return '{}'
  }
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-0.5">
        {value}
      </p>
      {hint && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

type FunnelRow = {
  name: string
  count: number
}

function computeBasicFunnel(items: TelemetryEventItem[]): FunnelRow[] {
  const counts: Record<string, number> = {}
  const interesting = [
    'page_view',
    'api_error',
    'client_exception',
    'flow_start',
    'flow_step_submit',
    'flow_complete',
    'flow_abandon',
  ]
  for (const it of items) {
    if (!interesting.includes(it.name)) continue
    counts[it.name] = (counts[it.name] ?? 0) + 1
  }
  return interesting.map((k) => ({ name: k, count: counts[k] ?? 0 }))
}

export default function AdminTelemetryPage() {
  const [from, setFrom] = useState<string>(isoDaysAgo(7).slice(0, 10))
  const [to, setTo] = useState<string>(new Date().toISOString().slice(0, 10))
  const [event, setEvent] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  const [anonId, setAnonId] = useState<string>('')
  const [limit, setLimit] = useState<number>(200)

  const [items, setItems] = useState<TelemetryEventItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<TelemetryEventItem | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    setSelected(null)
  }, [from, to, event, userId, anonId])

  async function load() {
    setLoading(true)
    setErrorMsg(null)
    try {
      const fromIso = from ? new Date(`${from}T00:00:00.000Z`).toISOString() : undefined
      const toIso = to ? new Date(`${to}T23:59:59.999Z`).toISOString() : undefined
      const uid = userId.trim() ? parseInt(userId.trim(), 10) : undefined
      const res = await telemetryApi.list({
        from: fromIso,
        to: toIso,
        event: event.trim() || undefined,
        user_id: Number.isFinite(uid as any) ? (uid as number) : undefined,
        anon_id: anonId.trim() || undefined,
        limit,
      })
      setItems(res?.items ?? [])
    } catch (e: any) {
      setErrorMsg(e?.detail ?? e?.message ?? 'Erreur')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const kpis = useMemo(() => {
    const total = items.length
    const apiErrors = items.filter((x) => x.name === 'api_error').length
    const clientErrors = items.filter((x) => x.name === 'client_exception').length
    const pageViews = items.filter((x) => x.name === 'page_view').length
    const uniqUsers = new Set(items.map((x) => x.user_id).filter((x) => x != null)).size
    const uniqAnon = new Set(items.map((x) => x.anon_id).filter(Boolean)).size
    return { total, apiErrors, clientErrors, pageViews, uniqUsers, uniqAnon }
  }, [items])

  const funnel = useMemo(() => computeBasicFunnel(items), [items])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-rose-500 bg-clip-text text-transparent">
            Télémétrie
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Explorateur d&apos;événements (usage, erreurs, API, flows).
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-rose-500 shadow-md hover:opacity-90 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Chargement…' : 'Rafraîchir'}
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-widest">Du</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-widest">Au</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-widest">Event</label>
            <input
              value={event}
              onChange={(e) => setEvent(e.target.value)}
              placeholder="page_view, api_error…"
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-widest">user_id</label>
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="ex: 123"
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-widest">anon_id</label>
            <input
              value={anonId}
              onChange={(e) => setAnonId(e.target.value)}
              placeholder="a_…"
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-widest">Limite</label>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value || '200', 10))}
              min={1}
              max={1000}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            />
          </div>
        </div>
        <div className="mt-3 flex gap-2 flex-wrap">
          <button
            onClick={() => void load()}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
            disabled={loading}
          >
            Appliquer
          </button>
          <button
            onClick={() => {
              setEvent('')
              setUserId('')
              setAnonId('')
            }}
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Reset filtres
          </button>
          {errorMsg && <span className="text-xs text-red-400 ml-auto">{errorMsg}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Events" value={kpis.total} />
        <Kpi label="Page views" value={kpis.pageViews} />
        <Kpi label="API errors" value={kpis.apiErrors} />
        <Kpi label="Client errors" value={kpis.clientErrors} />
        <Kpi label="Users (uniq)" value={kpis.uniqUsers} hint="user_id non-null" />
        <Kpi label="Anon (uniq)" value={kpis.uniqAnon} hint="anon_id" />
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
          Funnel rapide (best-effort)
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {funnel.map((r) => (
            <div key={r.name} className="rounded-xl border border-slate-100 dark:border-slate-800 p-3">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">{r.name}</p>
              <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">{r.count}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 mt-3">
          Pour des funnels précis par formulaire, utilisez les events <span className="font-mono">flow_*</span> avec un identifiant de flow/step dans <span className="font-mono">properties</span>.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Derniers événements
          </p>
          <span className="text-xs text-slate-400">{items.length} item(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800">
                {['Date', 'Event', 'Feature', 'Path', 'user_id', 'anon_id', ''].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr
                  key={it.id}
                  className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                    {formatTs(it.ts)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-slate-700 dark:text-slate-200">
                      {it.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {it.feature || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-[320px] truncate">
                    {it.path || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{it.user_id ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-[160px] truncate">
                    {it.anon_id || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelected(it)}
                      className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      Détail
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400 italic">
                    Aucun événement pour ces filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center pt-8 px-4 overflow-y-auto"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-[#0f172a] border-b border-slate-200 dark:border-slate-700 p-5 flex items-center justify-between z-10 rounded-t-2xl">
              <div>
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                  {selected.name}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {formatTs(selected.ts)} · id {selected.id}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                x
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Contexte</p>
                  <ul className="space-y-1 text-slate-600 dark:text-slate-300">
                    <li><span className="text-slate-400">feature</span> {selected.feature || '—'}</li>
                    <li><span className="text-slate-400">path</span> {selected.path || '—'}</li>
                    <li><span className="text-slate-400">referrer</span> {selected.referrer || '—'}</li>
                    <li><span className="text-slate-400">env</span> {selected.env || '—'}</li>
                    <li><span className="text-slate-400">app_host</span> {selected.app_host || '—'}</li>
                  </ul>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Identité</p>
                  <ul className="space-y-1 text-slate-600 dark:text-slate-300">
                    <li><span className="text-slate-400">user_id</span> {selected.user_id ?? '—'}</li>
                    <li><span className="text-slate-400">anon_id</span> {selected.anon_id || '—'}</li>
                    <li><span className="text-slate-400">session_id</span> {selected.session_id || '—'}</li>
                    <li><span className="text-slate-400">trace_id</span> {selected.trace_id || '—'}</li>
                  </ul>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-2">Properties</p>
                <pre className="text-[11px] leading-relaxed whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200 font-mono">
{safeJson(selected.properties)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

