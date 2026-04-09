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

const SLOW_API_MS = 1500
const VERY_SLOW_API_MS = 3500
const LONG_PAGE_MS = 2 * 60 * 1000

function getDurationMs(it: TelemetryEventItem): number | null {
  const p = it.properties || {}
  const v = (p as any)?.duration_ms
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

type Flag = { id: 'error' | 'slow' | 'very_slow' | 'long_page' | 'vital_poor'; label: string; cls: string }

function computeFlags(it: TelemetryEventItem): Flag[] {
  const flags: Flag[] = []
  const name = it.name
  const p = it.properties || {}

  if (name === 'api_error' || name === 'client_exception' || name === 'unhandled_rejection') {
    flags.push({ id: 'error', label: 'ERROR', cls: 'bg-red-700/20 text-red-300 border border-red-700/40' })
  }

  if (name === 'web_vital') {
    const rating = String((p as any)?.rating ?? '').toLowerCase()
    if (rating === 'poor') {
      flags.push({ id: 'vital_poor', label: 'POOR VITAL', cls: 'bg-amber-700/15 text-amber-300 border border-amber-700/35' })
    }
  }

  const dur = getDurationMs(it)
  if (dur != null) {
    if (name === 'api_response' || name === 'api_error' || name === 'api_request') {
      if (dur >= VERY_SLOW_API_MS) {
        flags.push({ id: 'very_slow', label: `VERY SLOW ${Math.round(dur)}ms`, cls: 'bg-orange-700/15 text-orange-300 border border-orange-700/35' })
      } else if (dur >= SLOW_API_MS) {
        flags.push({ id: 'slow', label: `SLOW ${Math.round(dur)}ms`, cls: 'bg-amber-700/15 text-amber-300 border border-amber-700/35' })
      }
    }
    if (name === 'page_duration' && dur >= LONG_PAGE_MS) {
      flags.push({ id: 'long_page', label: `LONG ${Math.round(dur / 1000)}s`, cls: 'bg-slate-700/20 text-slate-200 border border-slate-600/40' })
    }
  }

  // UI errors (quand on les instrumentera côté UI)
  if (name === 'ui_error_shown') {
    flags.push({ id: 'error', label: 'UI ERROR', cls: 'bg-red-700/20 text-red-300 border border-red-700/40' })
  }

  return flags
}

function rowTone(flags: Flag[]): string {
  if (flags.some((f) => f.id === 'error')) return 'bg-red-950/10'
  if (flags.some((f) => f.id === 'very_slow')) return 'bg-orange-950/10'
  if (flags.some((f) => f.id === 'slow' || f.id === 'vital_poor')) return 'bg-amber-950/10'
  return ''
}

function isUrgent(flags: Flag[]): boolean {
  return flags.some((f) => f.id === 'error' || f.id === 'very_slow' || f.id === 'vital_poor')
}

function Kpi({
  label,
  value,
  hint,
  onClick,
  active = false,
}: {
  label: string
  value: string | number
  hint?: string
  onClick?: () => void
  active?: boolean
}) {
  const clickable = typeof onClick === 'function'
  const cls = `rounded-2xl border bg-white dark:bg-slate-900 p-4 text-left transition-colors ${
    active
      ? 'border-violet-400/60 dark:border-violet-500/50 bg-violet-50/40 dark:bg-violet-950/10'
      : 'border-slate-200 dark:border-slate-700'
  } ${clickable ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer' : ''}`

  const Inner = (
    <>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-0.5">
        {value}
      </p>
      {hint && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
    </>
  )

  if (!clickable) {
    return <div className={cls}>{Inner}</div>
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {Inner}
    </button>
  )
}

type FunnelRow = {
  name: string
  count: number
}

type TelemetryEnvFilter = 'all' | 'production' | 'development'

function envBadgeClass(env: string | null | undefined): string {
  if (env === 'production') {
    return 'bg-emerald-900/30 text-emerald-300 border border-emerald-700/40'
  }
  if (env === 'development') {
    return 'bg-slate-700/40 text-slate-300 border border-slate-600/50'
  }
  return 'bg-slate-800/40 text-slate-500 border border-slate-700/40'
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
  const [envFilter, setEnvFilter] = useState<TelemetryEnvFilter>('all')

  const [items, setItems] = useState<TelemetryEventItem[]>([])
  const [loading, setLoading] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [selected, setSelected] = useState<TelemetryEventItem | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [onlyProblems, setOnlyProblems] = useState(false)
  const [urgentOnly, setUrgentOnly] = useState(false)
  const [slowOnly, setSlowOnly] = useState(false)

  useEffect(() => {
    setSelected(null)
  }, [from, to, event, userId, anonId, envFilter])

  async function load(overrides?: { env?: TelemetryEnvFilter }) {
    setLoading(true)
    setErrorMsg(null)
    const effectiveEnv = overrides?.env ?? envFilter
    try {
      const fromIso = from ? new Date(`${from}T00:00:00.000Z`).toISOString() : undefined
      const toIso = to ? new Date(`${to}T23:59:59.999Z`).toISOString() : undefined
      const uid = userId.trim() ? parseInt(userId.trim(), 10) : undefined
      const res = await telemetryApi.list({
        from: fromIso,
        to: toIso,
        event: event.trim() || undefined,
        env: effectiveEnv === 'all' ? undefined : effectiveEnv,
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

  async function clearAll() {
    if (clearing) return
    const ok1 = confirm(
      'Effacer TOUS les logs de télémétrie ? Cette action est irréversible.'
    )
    if (!ok1) return
    const ok2 = confirm('Confirmation: supprimer définitivement tous les événements ?')
    if (!ok2) return
    setClearing(true)
    setErrorMsg(null)
    try {
      await telemetryApi.clearAll()
      setItems([])
      setSelected(null)
    } catch (e: any) {
      setErrorMsg(e?.detail ?? e?.message ?? 'Erreur')
    } finally {
      setClearing(false)
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
    const slowApi = items.filter((x) => {
      if (x.name !== 'api_response' && x.name !== 'api_error') return false
      const d = getDurationMs(x)
      return d != null && d >= SLOW_API_MS
    }).length
    const problems = items.filter((x) => computeFlags(x).length > 0).length
    return { total, apiErrors, clientErrors, pageViews, uniqUsers, uniqAnon, slowApi, problems }
  }, [items])

  const funnel = useMemo(() => computeBasicFunnel(items), [items])
  const visibleItems = useMemo(() => {
    if (!onlyProblems && !urgentOnly && !slowOnly) return items
    return items.filter((x) => {
      const flags = computeFlags(x)
      if (urgentOnly) return isUrgent(flags)
      if (slowOnly) {
        if (x.name !== 'api_response' && x.name !== 'api_error') return false
        const d = getDurationMs(x)
        return d != null && d >= SLOW_API_MS
      }
      return flags.length > 0
    })
  }, [items, onlyProblems, urgentOnly, slowOnly])

  const topErrors = useMemo(() => {
    type Row = {
      key: string
      kind: 'api_error' | 'client_exception' | 'ui_error_shown' | 'unhandled_rejection'
      count: number
      last_ts: string
      sample_path?: string | null
      status?: number
      code?: string | null
      message?: string
    }
    const map = new Map<string, Row>()
    for (const it of items) {
      if (!['api_error', 'client_exception', 'ui_error_shown', 'unhandled_rejection'].includes(it.name)) continue
      const p = it.properties || {}
      const status = typeof (p as any)?.status === 'number' ? (p as any).status : undefined
      const code = typeof (p as any)?.code === 'string' ? (p as any).code : null
      const detail =
        typeof (p as any)?.detail === 'string'
          ? (p as any).detail
          : typeof (p as any)?.message === 'string'
            ? (p as any).message
            : ''
      const msg = String(detail || it.name || 'error').slice(0, 160)
      const key = it.name === 'api_error'
        ? `api_error|${status ?? 'na'}|${code ?? 'na'}|${msg}`
        : `${it.name}|${msg}`

      const prev = map.get(key)
      if (!prev) {
        map.set(key, {
          key,
          kind: it.name as Row['kind'],
          count: 1,
          last_ts: it.ts,
          sample_path: it.path ?? null,
          status,
          code,
          message: msg,
        })
      } else {
        prev.count += 1
        if (new Date(it.ts).getTime() > new Date(prev.last_ts).getTime()) {
          prev.last_ts = it.ts
          prev.sample_path = it.path ?? prev.sample_path
        }
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
  }, [items])

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
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Environnement
            </span>
            <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {(
                [
                  { id: 'all' as const, label: 'Tous' },
                  { id: 'production' as const, label: 'Production' },
                  { id: 'development' as const, label: 'Développement' },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setEnvFilter(id)
                    void load({ env: id })
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                    envFilter === id
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-slate-500">
              Colonne <span className="font-mono">env</span> : prod vs dev (voir aussi détail).
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => void load()}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-rose-500 shadow-md hover:opacity-90 disabled:opacity-50"
            disabled={loading || clearing}
          >
            {loading ? 'Chargement…' : 'Rafraîchir'}
          </button>
          <button
            onClick={() => void clearAll()}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-red-200 bg-red-950/40 border border-red-700/50 hover:bg-red-950/55 disabled:opacity-50"
            disabled={clearing || loading}
            title="Supprime tous les événements enregistrés (TRUNCATE)."
          >
            {clearing ? 'Suppression…' : 'Effacer tous les logs'}
          </button>
        </div>
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
              setEnvFilter('all')
            }}
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Reset filtres
          </button>
          <button
            onClick={() => setOnlyProblems((v) => !v)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
              onlyProblems
                ? 'border-rose-700/40 bg-rose-950/20 text-rose-200'
                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
            title="Affiche uniquement les événements marqués (erreur / lenteur / vital poor)."
          >
            Problèmes uniquement
          </button>
          <button
            onClick={() => setSlowOnly((v) => !v)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
              slowOnly
                ? 'border-amber-700/40 bg-amber-950/20 text-amber-200'
                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
            title={`Affiche seulement les événements API avec duration_ms ≥ ${SLOW_API_MS}ms.`}
          >
            API slow
          </button>
          <button
            onClick={() => {
              setUrgentOnly((v) => !v)
              if (!urgentOnly) setOnlyProblems(false)
            }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
              urgentOnly
                ? 'border-red-700/40 bg-red-950/25 text-red-200'
                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
            title="Affiche seulement ERROR + VERY SLOW + POOR VITAL."
          >
            Urgent
          </button>
          {errorMsg && <span className="text-xs text-red-400 ml-auto">{errorMsg}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-3">
        <Kpi
          label="Events"
          value={kpis.total}
          active={!event && !onlyProblems && !urgentOnly && !slowOnly && envFilter === 'all'}
          onClick={() => {
            setEvent('')
            setOnlyProblems(false)
            setUrgentOnly(false)
            setSlowOnly(false)
            setEnvFilter('all')
            void load({ env: 'all' })
          }}
        />
        <Kpi
          label="Page views"
          value={kpis.pageViews}
          active={event.trim() === 'page_view'}
          onClick={() => {
            setEvent('page_view')
            setOnlyProblems(false)
            setUrgentOnly(false)
            setSlowOnly(false)
          }}
        />
        <Kpi
          label="API errors"
          value={kpis.apiErrors}
          active={event.trim() === 'api_error'}
          onClick={() => {
            setEvent('api_error')
            setOnlyProblems(true)
            setUrgentOnly(false)
            setSlowOnly(false)
          }}
        />
        <Kpi
          label="Client errors"
          value={kpis.clientErrors}
          active={event.trim() === 'client_exception'}
          onClick={() => {
            setEvent('client_exception')
            setOnlyProblems(true)
            setUrgentOnly(false)
            setSlowOnly(false)
          }}
        />
        <Kpi
          label="API slow (≥1.5s)"
          value={kpis.slowApi}
          hint="api_response/api_error duration_ms"
          active={slowOnly}
          onClick={() => {
            setEvent('')
            setOnlyProblems(false)
            setUrgentOnly(false)
            setSlowOnly(true)
          }}
        />
        <Kpi
          label="Flags"
          value={kpis.problems}
          hint="events marqués"
          active={onlyProblems}
          onClick={() => {
            setOnlyProblems(true)
            setUrgentOnly(false)
            setSlowOnly(false)
          }}
        />
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

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Top erreurs (groupées)
          </p>
          <p className="text-[10px] text-slate-400">
            Clique pour filtrer rapidement sur un type d&apos;erreur.
          </p>
        </div>
        {topErrors.length === 0 ? (
          <p className="text-sm text-slate-400 italic mt-3">Aucune erreur sur la période.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800">
                  {['Type', 'Message', 'Count', 'Dernière', 'Path', ''].map((h) => (
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
                {topErrors.map((r) => (
                  <tr
                    key={r.key}
                    className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-red-300">
                        {r.kind}
                        {r.kind === 'api_error' && r.status != null ? ` (${r.status})` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 max-w-[520px] truncate">
                      {r.message || '—'}
                      {r.kind === 'api_error' && r.code ? (
                        <span className="ml-2 text-[10px] text-slate-400 font-mono">code {r.code}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{r.count}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatTs(r.last_ts)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[320px] truncate">{r.sample_path || '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          setEvent(r.kind)
                          setOnlyProblems(true)
                          setUrgentOnly(false)
                          void load()
                        }}
                        className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                      >
                        Filtrer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Derniers événements
          </p>
          <span className="text-xs text-slate-400">
            {visibleItems.length} item(s){onlyProblems ? ' (filtrés)' : ''}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800">
                {['Date', 'Env', 'Event', 'Flags', 'Feature', 'Path', 'user_id', 'anon_id', ''].map((h) => (
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
              {visibleItems.map((it) => {
                const flags = computeFlags(it)
                const tone = rowTone(flags)
                return (
                <tr
                  key={it.id}
                  className={`border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 ${tone}`}
                >
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                    {formatTs(it.ts)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${envBadgeClass(it.env)}`}
                    >
                      {it.env === 'production' ? 'prod' : it.env === 'development' ? 'dev' : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-slate-700 dark:text-slate-200">
                      {it.name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {flags.length === 0 ? (
                      <span className="text-[10px] text-slate-300">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {flags.slice(0, 3).map((f) => (
                          <span key={f.label} className={`text-[10px] px-2 py-0.5 rounded-full ${f.cls}`}>
                            {f.label}
                          </span>
                        ))}
                        {flags.length > 3 && (
                          <span className="text-[10px] text-slate-400">+{flags.length - 3}</span>
                        )}
                      </div>
                    )}
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
              )})}
              {visibleItems.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-400 italic">
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

