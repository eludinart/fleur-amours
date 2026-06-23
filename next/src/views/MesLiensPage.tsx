// @ts-nocheck
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { socialApi, type LienItem, INTENTIONS } from '@/api/social'
import { useSocialStore } from '@/store/useSocialStore'
import { CommunityMeteoStrip } from '@/components/social/CommunityMeteoStrip'
import { MaturityBadges } from '@/components/social/MaturityBadges'
import { t } from '@/i18n'

type FilterId = 'all' | 'unread' | 'pending' | 'accepted' | 'dormant'

const RELATION_BADGE: Record<LienItem['relation'], { tone: string; label: () => string; emoji: string }> = {
  pending_in: {
    tone: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    label: () => t('liens.statusPendingIn'),
    emoji: '🌱',
  },
  pending_out: {
    tone: 'bg-slate-700/40 text-slate-300 border-slate-500/40',
    label: () => t('liens.statusPendingOut'),
    emoji: '🌱',
  },
  accepted: {
    tone: 'bg-violet-500/15 text-violet-200 border-violet-400/30',
    label: () => t('liens.statusAccepted'),
    emoji: '💬',
  },
  arrosage_recent: {
    tone: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    label: () => t('liens.statusArrosageRecent'),
    emoji: '💧',
  },
  pollen_recent: {
    tone: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    label: () => t('liens.statusPollenRecent'),
    emoji: '🌸',
  },
}

function formatLastContact(iso) {
  if (!iso) return null
  const ts = new Date(String(iso).replace(' ', 'T')).getTime()
  if (!Number.isFinite(ts)) return null
  const diffMs = Date.now() - ts
  const days = Math.floor(diffMs / 86400000)
  if (days <= 0) return t('liens.today')
  if (days === 1) return t('liens.yesterday')
  if (days < 7) return t('liens.daysAgo', { count: days })
  return new Date(ts).toLocaleDateString()
}

function intentionLabel(id: string | null) {
  if (!id) return null
  const map: Record<string, string> = {
    resonance: t('liens.intentionResonance'),
    eclairage: t('liens.intentionEclairage'),
    ludus: t('liens.intentionLudus'),
    philia: t('liens.intentionPhilia'),
    agape: t('liens.intentionAgape'),
  }
  return map[id] || INTENTIONS.find((x) => x.id === id)?.label || id
}

export default function MesLiensPage() {
  const router = useRouter()
  const { user } = useAuth()
  const acceptConnection = useSocialStore((s) => s.acceptConnection)
  const [liens, setLiens] = useState<LienItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<FilterId>('all')
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await socialApi.getMyLiens()
      setLiens(data?.liens ?? [])
    } catch (err) {
      setError((err as { detail?: string; message?: string })?.detail || (err as Error)?.message || 'Erreur')
      setLiens([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Rafraîchir périodiquement et au focus (présence, nouvelles graines)
  useEffect(() => {
    if (!user) return
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    const interval = setInterval(load, 90_000)
    return () => {
      window.removeEventListener('focus', onFocus)
      clearInterval(interval)
    }
  }, [user, load])

  const filtered = useMemo(() => {
    switch (filter) {
      case 'unread':
        return liens.filter((l) => l.unreadCount > 0 || l.relation === 'pending_in')
      case 'pending':
        return liens.filter((l) => l.relation === 'pending_in' || l.relation === 'pending_out')
      case 'accepted':
        return liens.filter((l) => l.relation === 'accepted')
      case 'dormant':
        return liens.filter((l) => l.relation === 'arrosage_recent' || l.relation === 'pollen_recent')
      default:
        return liens
    }
  }, [filter, liens])

  const counts = useMemo(() => {
    let unread = 0
    let pending = 0
    let accepted = 0
    let dormant = 0
    for (const l of liens) {
      if (l.unreadCount > 0 || l.relation === 'pending_in') unread += 1
      if (l.relation === 'pending_in' || l.relation === 'pending_out') pending += 1
      if (l.relation === 'accepted') accepted += 1
      if (l.relation === 'arrosage_recent' || l.relation === 'pollen_recent') dormant += 1
    }
    return { unread, pending, accepted, dormant, all: liens.length }
  }, [liens])

  async function handleAccept(seedId: number, userId: number) {
    if (!seedId) return
    setBusyId(userId)
    try {
      const res = await acceptConnection(seedId)
      if (res?.channelId) router.push(`/clairiere/${res.channelId}`)
      else await load()
    } catch (err) {
      setError((err as Error)?.message || 'Erreur')
    } finally {
      setBusyId(null)
    }
  }

  async function handleSnooze(seedId: number, userId: number) {
    if (!seedId) return
    setBusyId(userId)
    try {
      await socialApi.snoozeSeed(seedId)
      await load()
    } catch (err) {
      setError((err as Error)?.message || 'Erreur')
    } finally {
      setBusyId(null)
    }
  }

  const filters: Array<{ id: FilterId; label: string; count: number }> = [
    { id: 'all', label: t('liens.filterAll'), count: counts.all },
    { id: 'unread', label: t('liens.filterUnread'), count: counts.unread },
    { id: 'pending', label: t('liens.filterPending'), count: counts.pending },
    { id: 'accepted', label: t('liens.filterAccepted'), count: counts.accepted },
    { id: 'dormant', label: t('liens.filterDormant'), count: counts.dormant },
  ]

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-slate-100 dark:bg-slate-900">
      <header className="shrink-0 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/60 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              🌱 {t('liens.title')}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('liens.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-800"
            title={t('common.retry')}
          >
            🔄
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                filter === f.id
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-violet-300'
              }`}
            >
              {f.label}
              {f.count > 0 && (
                <span className={`ml-1.5 ${filter === f.id ? 'text-violet-100' : 'text-slate-400'}`}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-3 max-w-xl">
          <CommunityMeteoStrip variant="compact" />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {error && (
          <div className="mb-3 rounded-lg bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-sm px-3 py-2">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="w-8 h-8 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="text-5xl mb-3">🌌</span>
            <p className="text-slate-600 dark:text-slate-300 text-sm mb-4 max-w-xs">{t('liens.empty')}</p>
            <Link
              href="/prairie"
              className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold"
            >
              🌻 {t('liens.openPrairie')}
            </Link>
          </div>
        ) : (
          <ul className="space-y-2 max-w-xl mx-auto">
            {filtered.map((l) => {
              const badge = RELATION_BADGE[l.relation]
              const last = formatLastContact(l.lastSignalAt)
              const intention = intentionLabel(l.intentionId)
              return (
                <li
                  key={`${l.userId}-${l.relation}`}
                  className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => router.push(`/lisiere/${l.userId}`)}
                      className="shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-violet-100 to-rose-100 dark:from-violet-900/40 dark:to-rose-900/40 flex items-center justify-center text-2xl relative"
                      title={t('liens.actionVisit')}
                    >
                      {l.avatarEmoji || '🌸'}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                          l.isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}
                      />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => router.push(`/lisiere/${l.userId}`)}
                          className="font-semibold text-slate-900 dark:text-slate-100 text-sm hover:underline truncate text-left"
                        >
                          {l.pseudo}
                        </button>
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border ${badge.tone}`}
                        >
                          <span>{badge.emoji}</span>
                          <span>{badge.label()}</span>
                        </span>
                        {l.unreadCount > 0 && (
                          <span className="min-w-[1.25rem] h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold">
                            {l.unreadCount > 99 ? '99+' : l.unreadCount}
                          </span>
                        )}
                      </div>
                      {intention && l.relation === 'pending_in' && (
                        <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300 italic">
                          {t('liens.intentionLabel', { label: intention })}
                        </p>
                      )}
                      {l.maturityBadges?.length > 0 && (
                        <MaturityBadges badges={l.maturityBadges} compact className="mt-1.5" />
                      )}
                      {last && (
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          {t('liens.lastContact')} · {last}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {l.relation === 'pending_in' && l.seedId ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAccept(l.seedId!, l.userId)}
                          disabled={busyId === l.userId}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 text-amber-950 text-xs font-semibold hover:bg-amber-400 disabled:opacity-50"
                        >
                          {busyId === l.userId ? '…' : t('liens.actionAccept')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSnooze(l.seedId!, l.userId)}
                          disabled={busyId === l.userId}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                        >
                          🌙 {t('liens.actionLater')}
                        </button>
                      </>
                    ) : null}
                    {l.relation === 'accepted' && l.channelId ? (
                      <Link
                        href={`/clairiere/${l.channelId}`}
                        className="px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-700 dark:text-violet-200 text-xs font-semibold border border-violet-400/30 hover:bg-violet-500/30"
                      >
                        💬 {t('liens.actionOpenChat')}
                      </Link>
                    ) : null}
                    <Link
                      href={`/lisiere/${l.userId}`}
                      className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 text-cyan-700 dark:text-cyan-300 text-xs font-medium border border-cyan-300/40 hover:bg-cyan-50 dark:hover:bg-cyan-950/30"
                    >
                      🌿 {t('liens.actionVisit')}
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
