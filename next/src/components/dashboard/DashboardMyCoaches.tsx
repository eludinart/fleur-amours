// @ts-nocheck
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { userCoachesApi } from '@/api/userCoaches'
import { INTENTIONS } from '@/api/social'

export function DashboardMyCoaches() {
  const { isCoach, isAdmin } = useAuth()
  const [coaches, setCoaches] = useState([])
  const [loading, setLoading] = useState(true)

  const intentionLabel = useMemo(() => {
    const map = new Map()
    INTENTIONS.forEach((i) => map.set(i.id, i.label))
    return map
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    userCoachesApi
      .myCoaches()
      .then((r) => {
        if (!cancelled) setCoaches(r?.coaches ?? [])
      })
      .catch(() => {
        if (!cancelled) setCoaches([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (isAdmin || isCoach) return null

  if (loading) {
    return (
      <div className="h-24 rounded-2xl bg-slate-200/40 dark:bg-slate-800/50 animate-pulse border border-slate-200/60 dark:border-slate-700/60" />
    )
  }

  if (!coaches.length) return null

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-5">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Vos coachs</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {coaches.map((c) => (
          <div key={c.coachUserId} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-lg shrink-0">
                  {c.avatarEmoji ?? '🌸'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{c.pseudo ?? 'Coach'}</p>
                  {c.email ? <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{c.email}</p> : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(c.intentionIds ?? []).map((id) => (
                <span
                  key={id}
                  className="text-[10px] px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60"
                >
                  {intentionLabel.get(id) ?? id}
                </span>
              ))}
            </div>

            <div className="pt-1">
              {c.channelId ? (
                <Link
                  href={`/clairiere/${c.channelId}`}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
                >
                  Ouvrir la Clairière →
                </Link>
              ) : (
                <button type="button" disabled className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-400 cursor-not-allowed">
                  Clairière non disponible
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

