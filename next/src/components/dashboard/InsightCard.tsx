// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { dashboardApi } from '@/api/dashboard'

export function InsightCard({ snapshots = [], className = '' }) {
  const [trend, setTrend] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasEnough = Array.isArray(snapshots) && snapshots.length >= 2

  useEffect(() => {
    if (!hasEnough) {
      setTrend('')
      return
    }
    setLoading(true)
    setError(null)
    dashboardApi
      .getTrend(snapshots)
      .then((res) => setTrend((res as { trend?: string })?.trend ?? ''))
      .catch((e) => {
        setError((e as Error)?.message ?? 'Erreur')
        setTrend('')
      })
      .finally(() => setLoading(false))
  }, [hasEnough, JSON.stringify(snapshots?.slice(0, 5))])

  if (!hasEnough && !loading) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className={`rounded-2xl border border-violet-200/60 dark:border-violet-800/60 bg-gradient-to-br from-violet-50/80 via-rose-50/50 to-amber-50/30 dark:from-violet-950/30 dark:via-rose-950/20 dark:to-amber-950/10 p-6 ${className}`}
    >
      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
        <span>🌱</span> Tendance
      </h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Analyse des 5 derniers snapshots</p>
      {loading ? (
        <div className="flex items-center gap-2 text-slate-500">
          <span className="w-4 h-4 border-2 border-violet-300 border-t-violet-500 rounded-full animate-spin" />
          <span className="text-sm">Analyse en cours…</span>
        </div>
      ) : error ? (
        <p className="text-sm text-amber-600 dark:text-amber-400">{error}</p>
      ) : trend ? (
        <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-medium">{trend}</p>
      ) : null}
    </motion.div>
  )
}
