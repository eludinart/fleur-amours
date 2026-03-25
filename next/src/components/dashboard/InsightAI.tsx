// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { dashboardApi } from '@/api/dashboard'
import { InfoBubble } from '@/components/InfoBubble'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

export function InsightAI({ petals = {}, className = '' }) {
  const locale = useStore((s) => s.locale)
  const [legacyInsight, setLegacyInsight] = useState('')
  const [facts, setFacts] = useState<Array<any>>([])
  const [hypotheses, setHypotheses] = useState<Array<any>>([])
  const [profileMeta, setProfileMeta] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasPetals = petals && Object.values(petals).some((v) => (v ?? 0) > 0.05)

  const [showHypotheses, setShowHypotheses] = useState(true)

  useEffect(() => {
    try {
      const v = window.localStorage.getItem('science_show_hypotheses')
      if (v === 'false') setShowHypotheses(false)
      if (v === 'true') setShowHypotheses(true)
    } catch {
      // localStorage may be unavailable; keep default.
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem('science_show_hypotheses', String(showHypotheses))
    } catch {
      // ignore
    }
  }, [showHypotheses])

  useEffect(() => {
    if (!hasPetals) {
      setLegacyInsight('')
      setFacts([])
      setHypotheses([])
      setProfileMeta(null)
      return
    }
    setLoading(true)
    setError(null)
    dashboardApi
      .getInsight(petals, locale)
      .then((res) => {
        const r = res as any
        if (r?.facts && r?.hypotheses) {
          setFacts(Array.isArray(r.facts) ? r.facts : [])
          setHypotheses(Array.isArray(r.hypotheses) ? r.hypotheses : [])
          setProfileMeta(r?.meta ?? null)
          setLegacyInsight('')
        } else {
          setLegacyInsight(r?.insight ?? '')
          setFacts([])
          setHypotheses([])
          setProfileMeta(null)
        }
      })
      .catch((e) => {
        setError((e as Error)?.message ?? t('insight.error'))
        setLegacyInsight('')
        setFacts([])
        setHypotheses([])
        setProfileMeta(null)
      })
      .finally(() => setLoading(false))
  }, [hasPetals, JSON.stringify(petals), locale])

  if (!hasPetals && !loading) return null

  const badgeFor = (confidenceLabel: string) => {
    if (confidenceLabel === 'high') {
      return { className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300', label: t('insight.confidenceHigh') }
    }
    if (confidenceLabel === 'medium') {
      return { className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300', label: t('insight.confidenceMedium') }
    }
    return { className: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300', label: t('insight.confidenceLow') }
  }

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
      ) : legacyInsight ? (
        <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed italic">{legacyInsight}</p>
      ) : facts?.length || hypotheses?.length ? (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">{t('insight.factsTitle')}</p>
            <ul className="space-y-2">
              {facts.slice(0, 2).map((f, idx) => (
                <li key={f?.id ?? idx} className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                  <span className="font-semibold">• </span>
                  {f?.text ?? ''}
                </li>
              ))}
              {!facts?.length ? <li className="text-sm text-slate-500">{t('insight.noFacts')}</li> : null}
            </ul>
          </div>

          <div className="pt-3 border-t border-violet-100/70 dark:border-violet-900/40">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {t('insight.hypothesesTitle')}
              </p>
              {hypotheses?.length ? (
                <button
                  type="button"
                  onClick={() => setShowHypotheses((s) => !s)}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-violet-200/70 dark:border-violet-800/60 text-violet-800 dark:text-violet-200 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                >
                  {showHypotheses ? t('insight.hideHypotheses') : t('insight.showHypotheses')}
                </button>
              ) : null}
            </div>
            {showHypotheses ? (
              <div className="mt-2 space-y-2">
                {hypotheses?.length ? (
                  <ul className="space-y-2">
                    {hypotheses.slice(0, 4).map((h, idx) => {
                      const b = badgeFor(h?.confidence_label ?? 'low')
                      return (
                        <li key={h?.id ?? idx} className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed flex gap-2">
                          <span className={`mt-0.5 inline-flex items-center h-5 px-2 rounded-full text-xs ${b.className}`}>
                            {b.label}
                          </span>
                          <span className="italic">{h?.text ?? ''}</span>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">{t('insight.noHypotheses')}</p>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('insight.probabilisticNote')}</p>
              </div>
            ) : null}
          </div>

          {profileMeta?.has_chat_context === false ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('insight.chatContextMissing')}
            </p>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  )
}
