// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { sessionsApi } from '@/api/sessions'
import { statsApi } from '@/api/stats'
import { tarotReadingsApi } from '@/api/tarotReadings'
import { chatApi } from '@/api/chat'
import { notificationsApi } from '@/api/notifications'
import { aiApi } from '@/api/ai'
import { adminApi, type SystemStatus } from '@/api/admin'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { VersionBadge } from '@/components/VersionBadge'
import { AdminDashboardSkeleton } from '@/components/DashboardSkeleton'

const statCardVariants = {
  violet: { gradient: 'from-violet-500/20 to-fuchsia-600/20', border: 'border-violet-200/60 dark:border-violet-800/60', iconBg: 'bg-violet-500/20' },
  rose: { gradient: 'from-rose-500/20 to-pink-600/20', border: 'border-rose-200/60 dark:border-rose-800/60', iconBg: 'bg-rose-500/20' },
  emerald: { gradient: 'from-emerald-500/20 to-teal-600/20', border: 'border-emerald-200/60 dark:border-emerald-800/60', iconBg: 'bg-emerald-500/20' },
}

function StatCard({
  label,
  value,
  sub,
  to,
  icon,
  color,
}: {
  label: string
  value?: number
  sub?: string
  to?: string
  icon: string
  color: 'violet' | 'rose' | 'emerald'
}) {
  const v = statCardVariants[color] ?? statCardVariants.violet
  const content = (
    <div
      className={`rounded-2xl border backdrop-blur-md overflow-hidden bg-white/60 dark:bg-slate-900/60 ${v.border} bg-gradient-to-br ${v.gradient} p-5 shadow-sm hover:opacity-95 hover:ring-2 hover:ring-accent/40 transition-all cursor-pointer`}
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${v.iconBg}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value ?? '—'}</p>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
          {sub && <p className="text-[10px] text-slate-400 mt-1">{sub}</p>}
        </div>
      </div>
      {to && (
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
          Voir les détails →
        </span>
      )}
    </div>
  )
  if (to) return <Link href={to} className="block min-w-0">{content}</Link>
  return content
}

function ShortcutCard({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <Link
      href={to}
      className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 hover:border-accent/40 hover:bg-accent/5 transition-colors"
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300 text-center leading-tight">{label}</span>
    </Link>
  )
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }

function formatDuration(seconds: number) {
  if (!seconds) return '-'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return m > 0 ? `${m} min` : `${s} s`
}

export default function AdminDashboardPage() {
  const [sessionsStats, setSessionsStats] = useState(null)
  const [fleurStats, setFleurStats] = useState(null)
  const [tarotStats, setTarotStats] = useState(null)
  const [chatStats, setChatStats] = useState(null)
  const [notifStats, setNotifStats] = useState(null)
  const [shadowStats, setShadowStats] = useState(null)
  const [openRouterStatus, setOpenRouterStatus] = useState({ status: 'loading', error: null as string | null, model: null as string | null })
  const [dbStatus, setDbStatus] = useState<{
    connected: boolean
    error?: string
    connectionInfo: {
      host: string
      port: number
      database: string
      user: string
      prefix: string
      viaTunnel?: boolean
      tunnelTarget?: string
    } | null
    version: string | null
    poolStats: { connections?: number; latencyMs?: number } | null
    latencyMs?: number | null
  } | null>(null)
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [infraExpanded, setInfraExpanded] = useState(true)

  useEffect(() => {
    adminApi
      .systemStatus()
      .then(setSystemStatus)
      .catch(() => setSystemStatus(null))
  }, [])

  useEffect(() => {
    adminApi
      .dbStatus()
      .then((res) => {
        setDbStatus({
          connected: res.connected,
          error: res.error,
          connectionInfo: res.connectionInfo,
          version: res.version,
          poolStats: res.poolStats ?? null,
          latencyMs: res.latencyMs ?? res.poolStats?.latencyMs ?? null,
        })
      })
      .catch(() =>
        setDbStatus({
          connected: false,
          error: 'Erreur API',
          connectionInfo: null,
          version: null,
          poolStats: null,
          latencyMs: null,
        })
      )
  }, [])

  useEffect(() => {
    aiApi
      .testOpenRouter()
      .then((res: { ok?: boolean; error?: string; model?: string }) => {
        setOpenRouterStatus({
          status: res?.ok ? 'ok' : 'error',
          error: res?.error ?? null,
          model: res?.model ?? null,
        })
      })
      .catch((e) => {
        setOpenRouterStatus({ status: 'error', error: (e as Error)?.message ?? 'Erreur réseau', model: null })
      })
  }, [])

  useEffect(() => {
    Promise.all([
      sessionsApi.stats().catch(() => null),
      statsApi.overview().catch(() => null),
      tarotReadingsApi.stats().catch(() => null),
      chatApi.stats().catch(() => null),
      notificationsApi.stats().catch(() => null),
      sessionsApi.shadowStats().catch(() => null),
    ]).then(([sess, fleur, tarot, chat, notifs, shadows]) => {
      setSessionsStats(sess)
      setFleurStats(fleur)
      setTarotStats(tarot)
      setChatStats(chat)
      setNotifStats(notifs)
      setShadowStats(shadows)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto">
        <AdminDashboardSkeleton />
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-6 min-w-0">
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <Breadcrumbs />
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">Dashboard Admin</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Statistiques d&apos;utilisation et raccourcis</p>
          </div>
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <VersionBadge />
            <div
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border backdrop-blur-sm text-sm ${
                dbStatus?.connected
                  ? 'border-emerald-200/60 dark:border-emerald-800/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : dbStatus?.error
                    ? 'border-amber-200/60 dark:border-amber-800/60 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                    : 'border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 text-slate-500'
              }`}
              title={
                dbStatus?.connectionInfo
                  ? dbStatus.connectionInfo.viaTunnel
                    ? `VPS ${dbStatus.connectionInfo.tunnelTarget} via tunnel SSH (localhost:${dbStatus.connectionInfo.port})`
                    : `${dbStatus.connectionInfo.host}:${dbStatus.connectionInfo.port} / ${dbStatus.connectionInfo.database}`
                  : undefined
              }
            >
              <span className="text-base">
                {!dbStatus && '⋯'}
                {dbStatus?.connected && '✓'}
                {dbStatus?.error && !dbStatus?.connected && '✗'}
              </span>
              <div>
                <div className="font-semibold">MariaDB</div>
                {dbStatus?.connected && dbStatus.connectionInfo && (
                  <div className="text-[10px] opacity-80 truncate max-w-[180px]">
                    {dbStatus.connectionInfo.viaTunnel && dbStatus.connectionInfo.tunnelTarget
                      ? `VPS (${dbStatus.connectionInfo.tunnelTarget}) via tunnel`
                      : `${dbStatus.connectionInfo.host}:${dbStatus.connectionInfo.port} / ${dbStatus.connectionInfo.database}`}
                  </div>
                )}
                {dbStatus?.error && (
                  <div className="text-[10px] opacity-80 truncate max-w-[140px]" title={dbStatus.error}>
                    {dbStatus.error}
                  </div>
                )}
              </div>
            </div>
            <div
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border backdrop-blur-sm text-sm ${
                openRouterStatus.status === 'ok'
                  ? 'border-emerald-200/60 dark:border-emerald-800/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : openRouterStatus.status === 'error'
                    ? 'border-amber-200/60 dark:border-amber-800/60 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                    : 'border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 text-slate-500'
              }`}
            >
              <span className="text-base">
                {openRouterStatus.status === 'loading' && '⋯'}
                {openRouterStatus.status === 'ok' && '✓'}
                {openRouterStatus.status === 'error' && '✗'}
              </span>
              <div>
                <div className="font-semibold">OpenRouter</div>
                {openRouterStatus.status === 'ok' && openRouterStatus.model && (
                  <div className="text-[10px] opacity-80 truncate max-w-[140px]">{openRouterStatus.model}</div>
                )}
                {openRouterStatus.status === 'error' && (
                  <div className="text-[10px] opacity-80 truncate max-w-[140px]" title={openRouterStatus.error ?? ''}>
                    {openRouterStatus.error || 'Erreur'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.header>

        <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
          <motion.section variants={item}>
            <button
              type="button"
              onClick={() => setInfraExpanded((v) => !v)}
              className="flex items-center justify-between w-full text-left text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <span className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    dbStatus?.connected && openRouterStatus.status === 'ok'
                      ? 'bg-emerald-500'
                      : dbStatus?.error || openRouterStatus.status === 'error'
                        ? 'bg-red-500'
                        : 'bg-slate-400'
                  }`}
                  title={
                    dbStatus?.connected && openRouterStatus.status === 'ok'
                      ? 'Tout est opérationnel'
                      : dbStatus?.error || openRouterStatus.status === 'error'
                        ? 'Problème de connexion'
                        : 'Vérification…'
                  }
                />
                Infrastructure & connexions
              </span>
              <span
                className={`inline-flex transition-transform ${infraExpanded ? 'rotate-180' : ''}`}
                aria-hidden
              >
                ▼
              </span>
            </button>
            {infraExpanded && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-700">
                {/* Base de données */}
                <div className="p-4 md:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Base de données</h3>
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        dbStatus?.connected
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                          : dbStatus?.error
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                            : 'bg-slate-500/10 text-slate-500'
                      }`}
                    >
                      <span>{dbStatus?.connected ? '●' : dbStatus?.error ? '!' : '⋯'}</span>
                      <span>{dbStatus?.connected ? 'Connectée' : dbStatus?.error ? 'Erreur' : 'Vérification…'}</span>
                    </div>
                  </div>
                  {dbStatus?.connected && dbStatus.connectionInfo ? (
                    <dl className="grid grid-cols-1 gap-2 text-sm">
                      {dbStatus.connectionInfo.viaTunnel && dbStatus.connectionInfo.tunnelTarget && (
                        <div className="col-span-full flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 text-xs font-medium mb-2">
                          <span>🔗</span>
                          <span>VPS via tunnel SSH — {dbStatus.connectionInfo.tunnelTarget}</span>
                        </div>
                      )}
                      <div className="flex justify-between gap-3 py-1 border-b border-slate-100 dark:border-slate-800">
                        <dt className="text-slate-500 dark:text-slate-400 font-medium shrink-0">Hôte</dt>
                        <dd className="text-slate-800 dark:text-slate-200 text-right truncate">
                          {dbStatus.connectionInfo.host}:{dbStatus.connectionInfo.port}
                          {dbStatus.connectionInfo.viaTunnel ? ' (tunnel local)' : ''}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 py-1 border-b border-slate-100 dark:border-slate-800">
                        <dt className="text-slate-500 dark:text-slate-400 font-medium shrink-0">Base</dt>
                        <dd className="text-slate-800 dark:text-slate-200 text-right truncate">{dbStatus.connectionInfo.database}</dd>
                      </div>
                      <div className="flex justify-between gap-3 py-1 border-b border-slate-100 dark:border-slate-800">
                        <dt className="text-slate-500 dark:text-slate-400 font-medium shrink-0">Utilisateur</dt>
                        <dd className="text-slate-800 dark:text-slate-200 text-right truncate">{dbStatus.connectionInfo.user}</dd>
                      </div>
                      <div className="flex justify-between gap-3 py-1 border-b border-slate-100 dark:border-slate-800">
                        <dt className="text-slate-500 dark:text-slate-400 font-medium shrink-0">Préfixe</dt>
                        <dd className="text-slate-800 dark:text-slate-200 text-right truncate font-mono text-xs">{dbStatus.connectionInfo.prefix}</dd>
                      </div>
                      {dbStatus.version && (
                        <div className="flex justify-between gap-3 py-1 border-b border-slate-100 dark:border-slate-800">
                          <dt className="text-slate-500 dark:text-slate-400 font-medium shrink-0">Version</dt>
                          <dd className="text-slate-800 dark:text-slate-200 text-right truncate text-xs">{dbStatus.version}</dd>
                        </div>
                      )}
                      {(dbStatus.latencyMs != null || dbStatus.poolStats?.latencyMs != null) && (
                        <div className="flex justify-between gap-3 py-1">
                          <dt className="text-slate-500 dark:text-slate-400 font-medium shrink-0">Latence</dt>
                          <dd className="text-slate-800 dark:text-slate-200 text-right">
                            <span className={((dbStatus.latencyMs ?? dbStatus.poolStats?.latencyMs) ?? 0) < 50 ? 'text-emerald-600 dark:text-emerald-400' : ((dbStatus.latencyMs ?? dbStatus.poolStats?.latencyMs) ?? 0) < 150 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}>
                              {dbStatus.latencyMs ?? dbStatus.poolStats?.latencyMs} ms
                            </span>
                          </dd>
                        </div>
                      )}
                    </dl>
                  ) : (
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      {dbStatus?.error ?? 'Connexion non configurée ou indisponible'}
                    </p>
                  )}
                </div>

                {/* OpenRouter (IA) */}
                <div className="p-4 md:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">OpenRouter (IA)</h3>
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        openRouterStatus.status === 'ok'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                          : openRouterStatus.status === 'error'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                            : 'bg-slate-500/10 text-slate-500'
                      }`}
                    >
                      <span>{openRouterStatus.status === 'ok' ? '●' : openRouterStatus.status === 'error' ? '!' : '⋯'}</span>
                      <span>
                        {openRouterStatus.status === 'ok' ? 'Opérationnel' : openRouterStatus.status === 'error' ? 'Erreur' : 'Vérification…'}
                      </span>
                    </div>
                  </div>
                  <dl className="grid grid-cols-1 gap-2 text-sm">
                    <div className="flex justify-between gap-3 py-1 border-b border-slate-100 dark:border-slate-800">
                      <dt className="text-slate-500 dark:text-slate-400 font-medium shrink-0">Modèle</dt>
                      <dd className="text-slate-800 dark:text-slate-200 text-right truncate text-xs">
                        {openRouterStatus.model ?? '—'}
                      </dd>
                    </div>
                    {openRouterStatus.status === 'error' && openRouterStatus.error && (
                      <div className="py-2 px-3 rounded-lg bg-amber-500/10 border border-amber-200/60 dark:border-amber-800/60">
                        <p className="text-xs text-amber-700 dark:text-amber-300 truncate" title={openRouterStatus.error}>
                          {openRouterStatus.error}
                        </p>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Serveur */}
                <div className="p-4 md:p-5 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Serveur</h3>
                    {systemStatus && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-600 dark:text-slate-400">
                        {systemStatus.nodeEnv}
                      </span>
                    )}
                  </div>
                  {systemStatus ? (
                    <dl className="grid grid-cols-1 gap-2 text-sm">
                      <div className="flex justify-between gap-3 py-1 border-b border-slate-100 dark:border-slate-800">
                        <dt className="text-slate-500 dark:text-slate-400 font-medium shrink-0">Hostname</dt>
                        <dd className="text-slate-800 dark:text-slate-200 text-right truncate font-mono text-xs">{systemStatus.hostname}</dd>
                      </div>
                      {systemStatus.publicIp && (
                        <div className="flex justify-between gap-3 py-1 border-b border-slate-100 dark:border-slate-800">
                          <dt className="text-slate-500 dark:text-slate-400 font-medium shrink-0">IP publique</dt>
                          <dd className="text-slate-800 dark:text-slate-200 text-right truncate font-mono text-xs">{systemStatus.publicIp}</dd>
                        </div>
                      )}
                      <div className="flex justify-between gap-3 py-1 border-b border-slate-100 dark:border-slate-800">
                        <dt className="text-slate-500 dark:text-slate-400 font-medium shrink-0">Uptime</dt>
                        <dd className="text-slate-800 dark:text-slate-200 text-right truncate">{systemStatus.uptimeFormatted}</dd>
                      </div>
                      <div className="flex justify-between gap-3 py-1 border-b border-slate-100 dark:border-slate-800">
                        <dt className="text-slate-500 dark:text-slate-400 font-medium shrink-0">Mémoire</dt>
                        <dd className="text-slate-800 dark:text-slate-200 text-right truncate">
                          {systemStatus.memory.heapUsed} / {systemStatus.memory.heapTotal}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 py-1 border-b border-slate-100 dark:border-slate-800">
                        <dt className="text-slate-500 dark:text-slate-400 font-medium shrink-0">CPU</dt>
                        <dd className="text-slate-800 dark:text-slate-200 text-right truncate">
                          {systemStatus.cpu.cores} cœurs · load {systemStatus.cpu.loadAvg1m}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 py-1">
                        <dt className="text-slate-500 dark:text-slate-400 font-medium shrink-0">OS</dt>
                        <dd className="text-slate-800 dark:text-slate-200 text-right truncate text-xs">
                          {systemStatus.platform} / {systemStatus.arch}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="text-sm text-slate-400">Chargement…</p>
                  )}
                </div>

                {/* Coolify */}
                {systemStatus?.coolify?.configured && systemStatus.coolify.servers.length > 0 && (
                  <div className="p-4 md:p-5 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Coolify</h3>
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-violet-500/15 text-violet-700 dark:text-violet-400">
                        {systemStatus.coolify.servers.length} serveur{systemStatus.coolify.servers.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {systemStatus.coolify.servers.map((srv) => (
                        <div
                          key={srv.uuid || srv.name}
                          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs ${
                            srv.unreachable
                              ? 'bg-amber-500/10 border border-amber-200/60 dark:border-amber-800/60'
                              : 'bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{srv.name}</p>
                            <p className="text-slate-500 dark:text-slate-400 truncate font-mono">{srv.ip}</p>
                          </div>
                          {srv.unreachable && (
                            <span className="shrink-0 text-amber-600 dark:text-amber-400 font-medium">!</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            )}
          </motion.section>

          {(chatStats?.unread_messages ?? 0) > 0 ? (
            <motion.section variants={item} className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/admin/chat"
                className="flex-1 flex items-center gap-3 px-5 py-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/60 hover:bg-amber-100/80 dark:hover:bg-amber-950/50 backdrop-blur-sm transition-all hover:ring-2 hover:ring-amber-400/30"
              >
                <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                  {chatStats!.unread_messages!} message{chatStats!.unread_messages! > 1 ? 's' : ''} de chat non lu
                  {chatStats!.unread_messages! > 1 ? 's' : ''}
                  {(chatStats?.open ?? 0) > 0 && (
                    <span className="ml-1 font-normal opacity-70">
                      · {chatStats!.open} conversation{(chatStats!.open ?? 0) > 1 ? 's' : ''} ouverte
                      {(chatStats!.open ?? 0) > 1 ? 's' : ''}
                    </span>
                  )}
                </span>
                <span className="ml-auto text-amber-500 dark:text-amber-400 text-xs font-medium">Répondre →</span>
              </Link>
            </motion.section>
          ) : null}

          <motion.div variants={item}>
            <Link
              href="/admin/analytics"
              className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-95 transition-all shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30"
            >
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl">📊</div>
              <div>
                <p className="font-bold text-sm">Analytics & Profiling</p>
                <p className="text-xs text-white/80">Fleur moyenne · Ombres · Clusters · Activité</p>
              </div>
              <span className="ml-auto text-white/90">→</span>
            </Link>
          </motion.div>

          {shadowStats && ((shadowStats.urgent ?? 0) > 0 || (shadowStats.recent_7d ?? 0) > 0) ? (
            <motion.section variants={item}>
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Parts d&apos;ombre détectées
              </h2>
              {(shadowStats.urgent ?? 0) > 0 && (
                <Link
                  href="/admin/sessions?shadow=1"
                  className="flex items-start gap-3 px-5 py-4 mb-3 rounded-2xl bg-red-500/10 dark:bg-red-950/30 border border-red-200/60 dark:border-red-800/60 hover:bg-red-500/15 dark:hover:bg-red-950/50 backdrop-blur-sm transition-all"
                >
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-red-600 dark:text-red-300">
                        {shadowStats.urgent} session{shadowStats.urgent > 1 ? 's' : ''} en détresse (niveau 4)
                      </span>
                      <p className="text-xs text-red-400/70 mt-0.5">
                        Ces personnes ont exprimé quelque chose d&apos;urgent — un contact est recommandé.
                      </p>
                    </div>
                  <span className="text-red-500 dark:text-red-400 text-xs shrink-0 font-medium">Voir →</span>
                </Link>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <div className="rounded-2xl border border-red-200/60 dark:border-red-800/60 bg-red-500/10 dark:bg-red-950/20 p-4 text-center backdrop-blur-sm">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-300">{shadowStats.urgent ?? 0}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Urgentes (niv. 4)</p>
                </div>
                <div className="rounded-2xl border border-rose-200/60 dark:border-rose-800/60 bg-rose-500/10 dark:bg-rose-950/20 p-4 text-center backdrop-blur-sm">
                  <p className="text-2xl font-bold text-rose-600 dark:text-rose-300">{shadowStats.recent_7d ?? 0}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Avec ombre — 7 derniers jours</p>
                </div>
                <div className="rounded-2xl border border-amber-200/60 dark:border-amber-800/60 bg-amber-500/10 dark:bg-amber-950/20 p-4 text-center backdrop-blur-sm">
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-300">{shadowStats.total_with_shadow ?? 0}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Total sessions avec ombre</p>
                </div>
              </div>
              {shadowStats.recent_sessions?.length > 0 && (
                <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden backdrop-blur-sm bg-white/50 dark:bg-slate-900/50">
                <div className="bg-slate-50/80 dark:bg-slate-800/50 px-4 py-2.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Dernières détections
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {shadowStats.recent_sessions.slice(0, 5).map((s: { id: string; created_at: string; first_words?: string; email?: string; shadow_urgent?: boolean; max_shadow_level?: number }) => {
                        const levelColor = s.shadow_urgent
                          ? 'text-red-400 border-red-700/50 bg-red-950/30'
                          : (s.max_shadow_level ?? 0) >= 3
                            ? 'text-rose-400 border-rose-700/40 bg-rose-950/20'
                            : (s.max_shadow_level ?? 0) >= 2
                              ? 'text-orange-400 border-orange-700/40 bg-orange-950/20'
                              : 'text-amber-400 border-amber-700/30 bg-amber-950/10'
                        const levelIcon = s.shadow_urgent ? '🔴' : (s.max_shadow_level ?? 0) >= 3 ? '🌑' : (s.max_shadow_level ?? 0) >= 2 ? '🌘' : '🌗'
                        return (
                          <Link
                            key={s.id}
                            href="/admin/sessions?shadow=1"
                            className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <span
                              className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border ${levelColor}`}
                            >
                              {levelIcon} Niv. {s.max_shadow_level ?? 0}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                                {s.email || 'Anonyme'}
                              </p>
                              {s.first_words && (
                                <p className="text-xs text-slate-400 truncate italic">&quot;{s.first_words}&quot;</p>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {new Date(s.created_at).toLocaleDateString('fr-FR')}
                            </span>
                          </Link>
                        )
                      })}
                </div>
                <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800">
                  <Link href="/admin/sessions?shadow=1" className="text-xs font-semibold text-accent hover:underline">
                    Voir toutes les sessions avec ombre →
                  </Link>
                </div>
                  </div>
                )}
            </motion.section>
          ) : null}

          <motion.section variants={item}>
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
              Statistiques d&apos;utilisation
            </h2>
            <motion.div variants={container} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard
                  label="Sessions IA"
                  value={sessionsStats?.total}
                  sub={sessionsStats ? `~${formatDuration(sessionsStats.avg_duration)} en moyenne` : undefined}
                  to="/admin/sessions"
                  icon="🌿"
                  color="violet"
                />
                <StatCard
                  label="Ma Fleur d'AmOurs"
                  value={fleurStats?.total}
                  sub={fleurStats ? `${fleurStats.total_solo ?? 0} solo · ${fleurStats.total_duo ?? 0} duo` : undefined}
                  to="/stats"
                  icon="🌸"
                  color="rose"
                />
                <StatCard
                  label="Tirages"
                  value={tarotStats?.total ?? 0}
                  sub="Utilisateurs connectés"
                  to="/admin/tirages"
                  icon="🎴"
                  color="emerald"
                />
                <StatCard
                  label="Conversations chat"
                  value={chatStats?.total ?? 0}
                  sub={
                    chatStats
                      ? `${chatStats.open ?? 0} ouverte${(chatStats.open ?? 0) > 1 ? 's' : ''} · ${chatStats.unread_messages ?? 0} msg non lu${(chatStats.unread_messages ?? 0) > 1 ? 's' : ''}`
                      : undefined
                  }
                  to="/admin/chat"
                  icon="💬"
                  color="violet"
                />
                <StatCard
                  label="Notifications"
                  value={notifStats?.total ?? 0}
                  sub={
                    notifStats
                      ? `${notifStats.delivered ?? 0} délivrées · ${notifStats.unread ?? 0} non lue${(notifStats.unread ?? 0) > 1 ? 's' : ''}`
                      : undefined
                  }
                  to="/admin/notifications"
                  icon="🔔"
                  color="emerald"
                />
            </motion.div>
          </motion.section>

          {sessionsStats && (
            <motion.section variants={item}>
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
                Sessions IA — Détails
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="rounded-2xl border border-amber-200/60 dark:border-amber-800/60 bg-amber-500/10 dark:bg-amber-950/20 p-4 text-center backdrop-blur-sm">
                  <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{sessionsStats.in_progress ?? 0}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">En cours</p>
                </div>
                <div className="rounded-2xl border border-emerald-200/60 dark:border-emerald-800/60 bg-emerald-500/10 dark:bg-emerald-950/20 p-4 text-center backdrop-blur-sm">
                  <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{sessionsStats.completed ?? 0}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Terminées</p>
                </div>
                <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-white/50 dark:bg-slate-900/50 p-4 text-center backdrop-blur-sm">
                  <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{sessionsStats.avg_turns ?? '—'}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Moy. tours / session</p>
                </div>
                <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-white/50 dark:bg-slate-900/50 p-4 text-center backdrop-blur-sm">
                  <p className="text-xl font-bold text-slate-800 dark:text-slate-100">
                    {sessionsStats.avg_duration ? formatDuration(sessionsStats.avg_duration) : '—'}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Durée moyenne</p>
                </div>
                <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-white/50 dark:bg-slate-900/50 p-4 text-center backdrop-blur-sm">
                  <p className="text-xl font-bold text-slate-800 dark:text-slate-100">
                    {sessionsStats.door_distribution?.[0]?.door ? (
                      <span className="capitalize">{sessionsStats.door_distribution[0].door}</span>
                    ) : (
                      '—'
                    )}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Porte la plus fréquente</p>
                </div>
              </div>
            </motion.section>
          )}

          {chatStats && (
            <motion.section variants={item}>
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
                Chat — Détails
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div
                  className={`rounded-2xl border p-4 text-center backdrop-blur-sm ${
                    (chatStats.open ?? 0) > 0
                      ? 'border-amber-200/60 dark:border-amber-800/60 bg-amber-500/10 dark:bg-amber-950/20'
                      : 'border-slate-200/60 dark:border-slate-700/60 bg-white/50 dark:bg-slate-900/50'
                  }`}
                >
                  <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{chatStats.open ?? 0}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Conversations ouvertes</p>
                </div>
                <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-white/50 dark:bg-slate-900/50 p-4 text-center backdrop-blur-sm">
                  <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{chatStats.closed ?? 0}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Clôturées</p>
                </div>
                <div
                  className={`rounded-2xl border p-4 text-center backdrop-blur-sm ${
                    (chatStats.unread_messages ?? 0) > 0
                      ? 'border-rose-200/60 dark:border-rose-800/60 bg-rose-500/10 dark:bg-rose-950/20'
                      : 'border-slate-200/60 dark:border-slate-700/60 bg-white/50 dark:bg-slate-900/50'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    {(chatStats.unread_messages ?? 0) > 0 && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                    )}
                    <p className="text-xl font-bold text-slate-800 dark:text-slate-100">
                      {chatStats.unread_messages ?? 0}
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Messages non lus</p>
                </div>
                <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-white/50 dark:bg-slate-900/50 p-4 text-center backdrop-blur-sm">
                  <p className="text-xl font-bold text-slate-800 dark:text-slate-100">
                    {chatStats.total_messages ?? 0}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Messages au total</p>
                </div>
              </div>
              {(chatStats.open ?? 0) > 0 && (
                <Link
                  href="/admin/chat"
                  className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-accent hover:underline"
                >
                  💬 Voir les conversations en cours →
                </Link>
              )}
            </motion.section>
          )}

          <motion.section variants={item}>
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
              Raccourcis
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              <ShortcutCard to="/admin/analytics" label="Analytics & Profiling" icon="📊" />
              <ShortcutCard to="/admin/suivi" label="Suivi utilisateurs" icon="🌸" />
              <ShortcutCard to="/admin/sessions" label="Sessions IA" icon="📋" />
              <ShortcutCard to="/admin/science" label="Science de la Fleur" icon="🧬" />
              <ShortcutCard to="/admin/chat" label="Chat" icon="💬" />
              <ShortcutCard to="/admin/users" label="Utilisateurs" icon="👥" />
              <ShortcutCard to="/admin/prompts" label="Prompts IA" icon="✏️" />
              <ShortcutCard to="/admin/notifications" label="Notifications" icon="🔔" />
              <ShortcutCard to="/stats" label="Statistiques Fleur" icon="📈" />
              <ShortcutCard to="/diagnostic" label="Diagnostic" icon="🔍" />
              <ShortcutCard to="/campaigns" label="Campagnes" icon="✉️" />
            </div>
          </motion.section>
        </motion.div>
      </div>
    </div>
  )
}
