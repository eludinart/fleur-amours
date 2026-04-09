'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
  PieChart,
  Pie,
} from 'recharts'
import { FlowerSVG, scoresToPetals } from '@/components/FlowerSVG'
import { sessionsApi } from '@/api/sessions'
import { useAuth } from '@/contexts/AuthContext'
import { PETAL_DEFS, PETAL_BY_ID } from '@/lib/petal-theme'

const PETAL_COLORS: Record<string, string> = Object.fromEntries(PETAL_DEFS.map((p) => [p.id, p.color]))
const PETAL_KEYS = [
  'agape',
  'philautia',
  'mania',
  'storge',
  'pragma',
  'philia',
  'ludus',
  'eros',
]
const SHADOW_COLORS = ['#64748b', '#f59e0b', '#f97316', '#e11d48', '#dc2626']

const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: 'rgba(15,23,42,0.97)',
  border: '1px solid rgba(148,163,184,0.2)',
  borderRadius: 12,
  fontSize: '12px',
}

function formatDuration(s?: number): string {
  if (!s) return '—'
  const m = Math.floor(s / 60)
  return m >= 60 ? `${Math.floor(m / 60)}h${m % 60}` : `${m} min`
}

function pct(v?: number): string {
  return `${Math.round((v ?? 0) * 100)}%`
}

function HeroCard({
  icon,
  value,
  label,
  sub,
  highlight,
  pulse,
}: {
  icon: string
  value: string | number
  label: string
  sub?: string
  highlight?: 'urgent' | 'rose' | 'emerald' | 'violet'
  pulse?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border p-5 flex flex-col gap-1 transition-all ${
        highlight === 'urgent'
          ? 'border-red-700/50 bg-red-950/20'
          : highlight === 'rose'
            ? 'border-rose-200 dark:border-rose-800 bg-gradient-to-br from-rose-50/50 to-rose-100/20 dark:from-rose-950/20 dark:to-rose-900/10'
            : highlight === 'emerald'
              ? 'border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50/50 dark:from-emerald-950/20'
              : highlight === 'violet'
                ? 'border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50/50 dark:from-violet-950/20'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="text-2xl">{icon}</span>
        {pulse && (
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse mt-1" />
        )}
      </div>
      <p
        className={`text-3xl font-bold mt-1 ${
          highlight === 'urgent'
            ? 'text-red-300'
            : highlight === 'rose'
              ? 'text-rose-500 dark:text-rose-400'
              : highlight === 'emerald'
                ? 'text-emerald-600 dark:text-emerald-400'
                : highlight === 'violet'
                  ? 'text-violet-600 dark:text-violet-400'
                  : 'text-slate-800 dark:text-slate-100'
        }`}
      >
        {value}
      </p>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </p>
      {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
    </div>
  )
}

function SectionTitle({
  children,
  sub,
}: {
  children: React.ReactNode
  sub?: string
}) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
        {children}
      </h2>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function ChartCard({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 ${className}`}
    >
      {children}
    </div>
  )
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2 shadow-xl">
      {label && (
        <p className="text-slate-400 text-[10px] mb-1">{label}</p>
      )}
      {payload.map((p, i) => (
        <p
          key={i}
          style={{ color: p.color || '#e2e8f0' }}
          className="text-xs font-medium"
        >
          {p.name} :{' '}
          {typeof p.value === 'number'
            ? p.value > 1
              ? p.value
              : (p.value * 100).toFixed(1) + '%'
            : p.value}
        </p>
      ))}
    </div>
  )
}

type RadarPoint = { petal: string; lumiere: number; ombre: number }

function FleurRadar({ radarData }: { radarData: RadarPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="rgba(148,163,184,0.15)" />
        <PolarAngleAxis dataKey="petal" tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fontSize: 9, fill: '#64748b' }}
          tickCount={4}
        />
        <Radar
          name="Lumière"
          dataKey="lumiere"
          stroke="#10b981"
          fill="#10b981"
          fillOpacity={0.25}
          strokeWidth={2}
        />
        <Radar
          name="Ombre/Déficit"
          dataKey="ombre"
          stroke="#f97316"
          fill="#f97316"
          fillOpacity={0.2}
          strokeWidth={1.5}
          strokeDasharray="4 2"
        />
        <Legend
          formatter={(v) => (
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>{v}</span>
          )}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v) => (v != null ? [`${Number(v).toFixed(1)}%`] : [])}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}

type ShadowItem = { label: string; count: number; color: string }

function ShadowDonut({ data }: { data: ShadowItem[] }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  if (!total) return <p className="text-xs text-slate-400 italic text-center py-8">Aucune donnée</p>
  return (
    <div className="flex flex-col items-center gap-3">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={3}
          >
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.color}
                opacity={entry.count === 0 ? 0.2 : 1}
              />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [v, n]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: d.color }}
            />
            <span>
              {d.label} ({d.count})
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

type LightShadowPoint = {
  petal: string
  key: string
  lumiere: number
  ombre: number
}

function LightShadowBar({ data }: { data: LightShadowPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
        <XAxis
          dataKey="petal"
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          stroke="rgba(148,163,184,0.2)"
        />
        <YAxis
          tick={{ fontSize: 9, fill: '#64748b' }}
          stroke="rgba(148,163,184,0.1)"
          tickFormatter={(v) => (v * 100).toFixed(0) + '%'}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(v) => (
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>{v}</span>
          )}
        />
        <Bar
          dataKey="lumiere"
          name="Lumière"
          fill="#10b981"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        >
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={PETAL_COLORS[entry.key] || '#10b981'}
              fillOpacity={0.85}
            />
          ))}
        </Bar>
        <Bar
          dataKey="ombre"
          name="Ombre/Déficit"
          fill="#f97316"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
          fillOpacity={0.7}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

type DominancePoint = { petal: string; label: string; count: number; pct?: number }

function DominanceBar({ data }: { data: DominancePoint[] }) {
  const sorted = [...data]
    .sort((a, b) => b.count - a.count)
    .filter((d) => d.count > 0)
  if (!sorted.length)
    return (
      <p className="text-xs text-slate-400 italic text-center py-8">
        Aucune donnée
      </p>
    )
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={sorted}
        layout="vertical"
        margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 9, fill: '#64748b' }}
          stroke="rgba(148,163,184,0.1)"
        />
        <YAxis
          dataKey="label"
          type="category"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          width={72}
          stroke="none"
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v) => (v != null ? [v + ' utilisateurs'] : [])}
        />
        <Bar dataKey="count" name="Utilisateurs" radius={[0, 6, 6, 0]} maxBarSize={22}>
          {sorted.map((d, i) => (
            <Cell key={i} fill={PETAL_COLORS[d.petal] || '#94a3b8'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

type ActivityPoint = { week: string; count: number }

function ActivityChart({ data }: { data: ActivityPoint[] }) {
  if (!data?.length)
    return (
      <p className="text-xs text-slate-400 italic text-center py-8">
        Aucune donnée
      </p>
    )
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
        <XAxis
          dataKey="week"
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          stroke="rgba(148,163,184,0.2)"
        />
        <YAxis
          tick={{ fontSize: 9, fill: '#64748b' }}
          stroke="rgba(148,163,184,0.1)"
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v) => (v != null ? [v + ' session' + (Number(v) > 1 ? 's' : '')] : [])}
        />
        <Bar
          dataKey="count"
          name="Sessions"
          fill="url(#actGrad)"
          radius={[5, 5, 0, 0]}
          maxBarSize={32}
        />
        <defs>
          <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.6} />
          </linearGradient>
        </defs>
      </BarChart>
    </ResponsiveContainer>
  )
}

type DoorPoint = { door: string; label: string; count: number }

function DoorChart({ data }: { data: DoorPoint[] }) {
  if (!data?.length)
    return (
      <p className="text-xs text-slate-400 italic text-center py-8">
        Aucune donnée
      </p>
    )
  const colors: Record<string, string> = {
    love: PETAL_BY_ID.agape.color,
    vegetal: PETAL_BY_ID.philia.color,
    elements: PETAL_BY_ID.ludus.color,
    life: PETAL_BY_ID.eros.color,
  }
  return (
    <div className="flex flex-col items-center gap-3">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="label"
            cx="50%"
            cy="50%"
            outerRadius={80}
            paddingAngle={4}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={colors[d.door] || '#94a3b8'} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v, n) => (v != null ? [v + ' sessions', n] : [])}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: colors[d.door] || '#94a3b8' }}
            />
            <span>
              {d.label} ({d.count})
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

type ClusterUser = {
  email: string
  avg_petals: Record<string, number>
  max_shadow_level?: number
}

function UserClusterSection({
  clusters,
  petalDominance,
}: {
  clusters: Record<string, ClusterUser[]>
  petalDominance: DominancePoint[]
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const order = petalDominance
    .map((d) => d.petal)
    .filter((k) => (clusters[k]?.length ?? 0) > 0)

  if (!order.length)
    return (
      <p className="text-xs text-slate-400 italic">Aucun profil disponible.</p>
    )

  return (
    <div className="space-y-3">
      {order.map((key) => {
        const users = clusters[key] || []
        if (!users.length) return null
        const color = PETAL_COLORS[key] || '#94a3b8'
        const isOpen = expanded === key
        const pctVal =
          petalDominance.find((d) => d.petal === key)?.pct ?? 0
        return (
          <div
            key={key}
            className="rounded-xl border overflow-hidden transition-all"
            style={{ borderColor: color + '40' }}
          >
            <button
              onClick={() => setExpanded(isOpen ? null : key)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
              style={{ background: color + '08' }}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="font-semibold text-sm" style={{ color }}>
                {petalDominance.find((d) => d.petal === key)?.label || key}
              </span>
              <span className="text-xs text-slate-400 ml-1">
                — {users.length} utilisateur
                {users.length > 1 ? 's' : ''}
              </span>
              <span
                className="text-xs font-bold ml-auto px-2 py-0.5 rounded-full"
                style={{ background: color + '20', color }}
              >
                {pct(pctVal)} du profil global
              </span>
              <span className="text-slate-400 text-sm ml-2">
                {isOpen ? '▲' : '▼'}
              </span>
            </button>
            {isOpen && (
              <div className="px-4 pb-4 pt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {users.map((u, i) => {
                  const shadowLvl = u.max_shadow_level ?? 0
                  const sp =
                    shadowLvl >= 4
                      ? { c: '#dc2626', i: '🔴' }
                      : shadowLvl >= 3
                        ? { c: '#e11d48', i: '🌑' }
                        : shadowLvl >= 2
                          ? { c: '#f97316', i: '🌘' }
                          : shadowLvl >= 1
                            ? { c: '#f59e0b', i: '🌗' }
                            : null
                  return (
                    <Link
                      key={i}
                      href="/admin/suivi"
                      className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-3 hover:border-violet-300 dark:hover:border-violet-700 transition-colors"
                    >
                      <FlowerSVG petals={u.avg_petals} size={44} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                          {u.email}
                        </p>
                        {sp && (
                          <p
                            className="text-[10px] mt-0.5"
                            style={{ color: sp.c }}
                          >
                            {sp.i} Ombre niv. {shadowLvl}
                          </p>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse ${className}`}
    />
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {Array(6)
          .fill(0)
          .map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  )
}

type AnalyticsData = {
  scope?: 'all' | 'patients'
  scope_label?: string
  scope_coach_user_id?: number | null
  scope_patient_count?: number | null
  total_users?: number
  total_sessions?: number
  completed_sessions?: number
  avg_turns?: number
  avg_duration?: number
  completion_rate?: number
  shadow_rate?: number
  shadow_events_7d?: number
  urgent_count?: number
  avg_petals?: Record<string, number>
  avg_deficit?: Record<string, number>
  radar_data?: RadarPoint[]
  light_vs_shadow?: LightShadowPoint[]
  shadow_distribution?: ShadowItem[]
  petal_dominance?: DominancePoint[]
  door_distribution?: DoorPoint[]
  user_clusters?: Record<string, ClusterUser[]>
  sessions_by_week?: ActivityPoint[]
}

export default function AdminAnalyticsPage() {
  const { isAdmin, isCoach } = useAuth()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState('all')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    sessionsApi
      .analyticsOverview()
      .then(setData as (d: unknown) => void)
      .catch((e) => setError((e as Error)?.message || 'Erreur de chargement'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const sections = [
    { id: 'all', label: 'Tout voir' },
    { id: 'fleur', label: '🌸 Fleur' },
    { id: 'ombres', label: '🌑 Ombres' },
    { id: 'profils', label: '👤 Profils' },
    { id: 'activite', label: '📈 Activité' },
  ]

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div
        className="max-w-6xl mx-auto px-4 py-8 space-y-8"
        style={{ animation: 'fadeIn 0.4s ease' }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-500 via-rose-500 to-amber-500 bg-clip-text text-transparent">
              Analytics · Profiling
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Indicateurs globaux · Dynamiques de la Fleur · Parts d&apos;ombre
            </p>
            {/* Périmètre — pour éviter toute ambiguïté coach vs admin */}
            {(isCoach || isAdmin) && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                    (data?.scope ?? (isAdmin ? 'all' : 'patients')) === 'all'
                      ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300'
                      : 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200'
                  }`}
                  title="Périmètre des données affichées"
                >
                  <span className="text-[11px]">
                    {(data?.scope ?? (isAdmin ? 'all' : 'patients')) === 'all' ? '🌍' : '🧑‍🌾'}
                  </span>
                  <span>
                    {data?.scope_label ??
                      ((data?.scope ?? (isAdmin ? 'all' : 'patients')) === 'all'
                        ? 'Toutes les sessions'
                        : 'Patientèle du coach')}
                  </span>
                  {data?.scope_patient_count != null &&
                    (data?.scope ?? (isAdmin ? 'all' : 'patients')) === 'patients' && (
                      <span className="opacity-80">
                        · {data.scope_patient_count} patient
                        {data.scope_patient_count > 1 ? 's' : ''}
                      </span>
                    )}
                </span>
                <span className="text-[10px] text-slate-400">
                  (Pour le détail par personne :{' '}
                  <Link href="/admin/suivi" className="underline">
                    Suivi individuel
                  </Link>
                  )
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              ↻ Actualiser
            </button>
            <Link
              href="/admin/suivi"
              className="px-3 py-2 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-100 transition-colors"
            >
              Suivi individuel →
            </Link>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                activeSection === s.id
                  ? 'bg-violet-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-4 text-sm text-red-600 dark:text-red-400">
            {error} —{' '}
            <button onClick={load} className="underline">
              Réessayer
            </button>
          </div>
        )}

        {loading ? (
          <DashboardSkeleton />
        ) : (
          data && (
            <>
              {(activeSection === 'all' || activeSection === 'activite') && (
                <section>
                  <SectionTitle sub="Vue instantanée de l'utilisation">
                    Chiffres clés
                  </SectionTitle>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <HeroCard
                      icon="👥"
                      value={data.total_users ?? 0}
                      label="Utilisateurs"
                      highlight="violet"
                    />
                    <HeroCard
                      icon="🌿"
                      value={data.total_sessions ?? 0}
                      label="Sessions"
                      sub={`${pct(data.completion_rate)} complètes`}
                      highlight="emerald"
                    />
                    <HeroCard
                      icon="💬"
                      value={data.avg_turns ?? 0}
                      label="Tours / session"
                      sub="en moyenne"
                    />
                    <HeroCard
                      icon="⏱"
                      value={formatDuration(data.avg_duration)}
                      label="Durée moyenne"
                    />
                    <HeroCard
                      icon="🌑"
                      value={pct(data.shadow_rate)}
                      label="Sessions avec ombre"
                      highlight="rose"
                    />
                    <HeroCard
                      icon="🔴"
                      value={data.urgent_count ?? 0}
                      label="Situations urgentes"
                      highlight={
                        (data.urgent_count ?? 0) > 0 ? 'urgent' : undefined
                      }
                      pulse={(data.urgent_count ?? 0) > 0}
                    />
                  </div>
                </section>
              )}

              {(activeSection === 'all' || activeSection === 'fleur') && (
                <section>
                  <SectionTitle sub="Dynamiques moyennes mesurées sur l'ensemble des utilisateurs">
                    Fleur d&apos;AmOurs — Profil global
                  </SectionTitle>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <ChartCard>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                        Fleur moyenne · {data.total_users} utilisateurs
                      </p>
                      <div className="flex flex-col items-center gap-4">
                        <FlowerSVG
                          petals={scoresToPetals(data.avg_petals)}
                          petalsDeficit={scoresToPetals(data.avg_deficit)}
                          size={280}
                          animate
                          showLabels
                        />
                        <div className="flex items-center gap-6 text-[10px] text-slate-400">
                          <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full bg-emerald-400" />
                            Parts de lumière
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full bg-amber-400" />
                            Déficits / Ombre
                          </span>
                        </div>
                      </div>
                    </ChartCard>

                    <ChartCard>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Radar des dynamiques
                      </p>
                      <p className="text-[10px] text-slate-400 mb-3">
                        Lumière (vert) vs Ombre/Déficit (orange) — en % du max
                        théorique
                      </p>
                      <FleurRadar radarData={data.radar_data ?? []} />
                    </ChartCard>
                  </div>

                  <ChartCard className="mt-5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Lumière vs Ombre par dynamique
                    </p>
                    <p className="text-[10px] text-slate-400 mb-4">
                      Comparaison de l&apos;expression positive et des tensions
                      pour chaque pétale
                    </p>
                    <LightShadowBar data={data.light_vs_shadow ?? []} />
                  </ChartCard>
                </section>
              )}

              {(activeSection === 'all' || activeSection === 'ombres') && (
                <section>
                  <SectionTitle sub="Distribution des niveaux de détresse détectés en session">
                    Carte des ombres
                  </SectionTitle>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <ChartCard>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Distribution des niveaux d&apos;ombre
                      </p>
                      <p className="text-[10px] text-slate-400 mb-4">
                        Répartition des utilisateurs selon le niveau max détecté
                      </p>
                      <ShadowDonut data={data.shadow_distribution ?? []} />
                    </ChartCard>

                    <ChartCard>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                        Indicateurs d&apos;ombre
                      </p>
                      <div className="space-y-3">
                        {(data.shadow_distribution ?? []).map((d, i) => {
                          const total = data.total_sessions || 1
                          return (
                            <div key={i} className="flex items-center gap-3">
                              <span className="text-lg shrink-0">
                                {['○', '🌗', '🌘', '🌑', '🔴'][i]}
                              </span>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                    {d.label}
                                  </span>
                                  <span
                                    className="text-xs font-bold"
                                    style={{ color: d.color }}
                                  >
                                    {d.count}
                                  </span>
                                </div>
                                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${Math.min(
                                        (d.count / total) * 100,
                                        100
                                      )}%`,
                                      backgroundColor: d.color,
                                    }}
                                  />
                                </div>
                              </div>
                              <span className="text-[10px] text-slate-400 w-8 text-right shrink-0">
                                {Math.round((d.count / total) * 100)}%
                              </span>
                            </div>
                          )
                        })}
                      </div>
                      <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-3">
                        <div className="rounded-xl p-3 bg-rose-950/10 border border-rose-800/30 text-center">
                          <p className="text-xl font-bold text-rose-400">
                            {pct(data.shadow_rate)}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Sessions avec ombre
                          </p>
                        </div>
                        <div
                          className={`rounded-xl p-3 border text-center ${
                            (data.urgent_count ?? 0) > 0
                              ? 'bg-red-950/20 border-red-700/40'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <p
                            className={`text-xl font-bold ${
                              (data.urgent_count ?? 0) > 0
                                ? 'text-red-300'
                                : 'text-slate-500'
                            }`}
                          >
                            {data.urgent_count ?? 0}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Urgences (niv. 4)
                          </p>
                        </div>
                      </div>
                      {(data.urgent_count ?? 0) > 0 && (
                        <Link
                          href="/admin/sessions?shadow=1"
                          className="mt-3 flex items-center gap-2 text-xs font-semibold text-red-400 hover:underline"
                        >
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          Voir les sessions urgentes →
                        </Link>
                      )}
                    </ChartCard>
                  </div>
                </section>
              )}

              {(activeSection === 'all' || activeSection === 'profils') && (
                <section>
                  <SectionTitle sub="Regroupement des utilisateurs selon leur dynamique d'amour dominante">
                    Profils — Dynamiques dominantes
                  </SectionTitle>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
                    <ChartCard>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Dynamique dominante par profil
                      </p>
                      <p className="text-[10px] text-slate-400 mb-4">
                        Nombre d&apos;utilisateurs dont cette dynamique ressort
                        en premier
                      </p>
                      <DominanceBar data={data.petal_dominance ?? []} />
                    </ChartCard>

                    <ChartCard>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Répartition par Porte
                      </p>
                      <p className="text-[10px] text-slate-400 mb-4">
                        Porte la plus souvent explorée par session
                      </p>
                      <DoorChart data={data.door_distribution ?? []} />
                    </ChartCard>
                  </div>

                  <ChartCard>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                      Clusters d&apos;utilisateurs par dynamique
                    </p>
                    <UserClusterSection
                      clusters={data.user_clusters ?? {}}
                      petalDominance={data.petal_dominance ?? []}
                    />
                  </ChartCard>
                </section>
              )}

              {(activeSection === 'all' || activeSection === 'activite') && (
                <section>
                  <SectionTitle sub="Fréquence d'utilisation sur les 12 dernières semaines">
                    Tendance d&apos;activité
                  </SectionTitle>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <ChartCard className="lg:col-span-2">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Sessions par semaine
                      </p>
                      <p className="text-[10px] text-slate-400 mb-4">
                        12 semaines glissantes
                      </p>
                      <ActivityChart data={data.sessions_by_week ?? []} />
                    </ChartCard>

                    <ChartCard>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                        Engagement
                      </p>
                      <div className="space-y-4">
                        {[
                          {
                            label: 'Taux de complétion',
                            value: data.completion_rate ?? 0,
                            color: '#10b981',
                          },
                          {
                            label: "Taux avec ombre",
                            value: data.shadow_rate ?? 0,
                            color: '#f97316',
                          },
                          {
                            label: 'Sessions urgentes',
                            value:
                              (data.total_sessions ?? 0) > 0
                                ? (data.urgent_count ?? 0) / data.total_sessions!
                                : 0,
                            color: '#dc2626',
                          },
                        ].map((m, i) => (
                          <div key={i}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs text-slate-500">
                                {m.label}
                              </span>
                              <span
                                className="text-sm font-bold"
                                style={{ color: m.color }}
                              >
                                {pct(m.value)}
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: pct(m.value),
                                  backgroundColor: m.color,
                                  opacity: 0.85,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                          {[
                            {
                              label: 'Moy. tours / session',
                              value: data.avg_turns,
                            },
                            {
                              label: 'Durée moyenne',
                              value: formatDuration(data.avg_duration),
                            },
                            {
                              label: 'Sessions terminées',
                              value: data.completed_sessions,
                            },
                            {
                              label: 'Événements ombre 7j',
                              value: data.shadow_events_7d ?? 0,
                            },
                          ].map((s, i) => (
                            <div key={i} className="flex justify-between text-xs">
                              <span className="text-slate-400">{s.label}</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-200">
                                {s.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </ChartCard>
                  </div>
                </section>
              )}
            </>
          )
        )}
      </div>
    </div>
  )
}
