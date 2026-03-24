// @ts-nocheck
'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { FlowerSVG } from '@/components/FlowerSVG'
import { InfoBubble } from '@/components/InfoBubble'
import { t } from '@/i18n'

export function EvolutionRadar({ currentPetals = {}, avgPetals30d = {}, currentSession = null, className = '' }) {
  const [mode, setMode] = useState('current')
  const petalsCurrent =
    Object.keys(currentPetals || {}).length > 0
      ? currentPetals
      : currentSession?.petals
        ? Object.fromEntries(Object.entries(currentSession.petals).map(([k, v]) => [k, Math.min(1, Math.max(0, v ?? 0))]))
        : {}
  const petalsAvg = Object.keys(avgPetals30d || {}).length > 0 ? avgPetals30d : {}
  const hasEvolution = Object.keys(petalsAvg).length > 0 && Object.keys(petalsCurrent).length > 0
  const petalsEvolution = hasEvolution && mode === 'current' ? { petals: petalsAvg } : null
  const displayPetals = mode === 'avg' ? petalsAvg : petalsCurrent
  const hasData = Object.values(displayPetals).some((v) => (v ?? 0) > 0.05)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className={`rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 p-6 min-h-[320px] flex flex-col ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t('evolution.title')}</h3>
          <InfoBubble title={t('evolution.title')} content={t('evolution.infoDesc')} />
        </div>
        {hasEvolution && (
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <button
              onClick={() => setMode('current')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === 'current' ? 'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
            >
              {t('evolution.current')}
            </button>
            <button
              onClick={() => setMode('avg')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === 'avg' ? 'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
            >
              {t('evolution.avg30d')}
            </button>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{mode === 'current' ? t('evolution.recentSession') : t('evolution.avg30dFull')}</p>
      <div className="flex justify-center flex-1 items-center py-4">
        {hasData ? (
          <FlowerSVG petals={displayPetals} petalsEvolution={petalsEvolution} size={220} animate showLabels showScores={false} />
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-500">
            <span className="text-4xl mb-2">📊</span>
            <p className="text-sm">{t('evolution.empty')}</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
