// @ts-nocheck
'use client'

import { motion } from 'framer-motion'
import { InfoBubble } from '@/components/InfoBubble'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

const SEUIL_PETALE_ARGENTE = 200

export function SèveTracker({ tokenBalance = 0, eternalSap = 0, totalAccumulatedEternal = 0, className = '' }) {
  useStore((s) => s.locale)
  const progress = Math.min(100, (totalAccumulatedEternal / SEUIL_PETALE_ARGENTE) * 100)
  const hasAura = totalAccumulatedEternal >= SEUIL_PETALE_ARGENTE

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className={`rounded-2xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-emerald-50/30 via-amber-50/20 to-amber-50/10 dark:from-emerald-950/20 dark:via-amber-950/10 dark:to-amber-950/5 p-6 ${className}`}
    >
      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
        <span>💎</span> {t('sap.title')}
        <InfoBubble title={t('sap.title')} content={t('sap.desc')} />
      </h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('sap.desc')}</p>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-4">
        {t('sap.sablier')} · {t('sap.cristal')} · {t('sap.petaleArgente')}
      </p>
      <div className="flex flex-col sm:flex-row gap-3 mb-6 min-w-0">
        <div className="flex-1 min-w-0 rounded-xl border border-emerald-200/60 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/30 p-4 flex items-center gap-3 overflow-hidden">
          <div className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold text-sm shadow-inner">
            {tokenBalance}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 truncate">Sablier</p>
            <p className="text-[10px] text-slate-500 truncate">Sève de Saison</p>
          </div>
        </div>
        <div className="flex-1 min-w-0 rounded-xl border border-amber-200/60 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/30 p-4 flex items-center gap-3 overflow-hidden">
          <div className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center bg-gradient-to-br from-amber-500 to-amber-600 text-white font-bold text-sm shadow-inner">
            {eternalSap}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 truncate">{t('sap.cristal')}</p>
            <p className="text-[10px] text-slate-500 truncate">{t('sap.eternelle')}</p>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">{t('sap.petaleArgente')}</span>
          <span className={`font-semibold ${hasAura ? 'text-amber-500' : 'text-slate-600 dark:text-slate-300'}`}>
            {totalAccumulatedEternal} / {SEUIL_PETALE_ARGENTE}
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`h-full rounded-full ${hasAura ? 'bg-gradient-to-r from-amber-400 to-slate-300' : 'bg-gradient-to-r from-amber-500 to-amber-400'}`}
          />
        </div>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">{t('sap.petaleArgenteBonus')}</p>
        {hasAura && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">{t('sap.auraUnlocked')}</p>
        )}
      </div>
    </motion.div>
  )
}
