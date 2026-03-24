// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { dashboardApi } from '@/api/dashboard'
import { InfoBubble } from '@/components/InfoBubble'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

export function InsightAI({ petals = {}, className = '' }) {
  useStore((s) => s.locale)
  const [insight, setInsight] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasPetals = petals && Object.values(petals).some((v) => (v ?? 0) > 0.05)

  useEffect(() => {
    if (!hasPetals) {
      setInsight('')
      return
    }
    setLoading(true)
    setError(null)
    dashboardApi
      .getInsight(petals)
      .then((res) => setInsight((res as { insight?: string })?.insight ?? ''))
      .catch((e) => {
        setError((e as Error)?.message ?? t('insight.error'))
        setInsight('')
      })
      .finally(() => setLoading(false))
  }, [hasPetals, JSON.stringify(petals)])

  if (!hasPetals && !loading) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className={`rounded-2xl border border-violet-200/60 dark:border-violet-800/60 bg-gradient-to-br from-violet-50/80 to-rose-50/50 dark:from-violet-950/30 dark:to-rose-950/20 p-6 ${className}`}
    >
      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
        <span>✨</span> {t('insight.title')}
        <InfoBubble title={t('insight.infoTitle')} content={t('insight.infoDesc')} />
      </h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t('insight.subtitle')}</p>
      {loading ? (
        <div className="flex items-center gap-2 text-slate-500">
          <span className="w-4 h-4 border-2 border-violet-300 border-t-violet-500 rounded-full animate-spin" />
          <span className="text-sm">{t('insight.loading')}</span>
        </div>
      ) : error ? (
        <p className="text-sm text-amber-600 dark:text-amber-400">{error}</p>
      ) : insight ? (
        <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed italic">{insight}</p>
      ) : null}
    </motion.div>
  )
}
