// @ts-nocheck
'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
}

const cards = [
  { key: 'sessions', labelKey: 'statsOverview.sessions', valueKey: 'sessions_count', icon: '⏳', gradient: 'from-cyan-500/20 to-blue-600/20', border: 'border-cyan-200/60 dark:border-cyan-800/60', iconBg: 'bg-cyan-500/20', to: '/session#section-sessions' },
  { key: 'cards', labelKey: 'statsOverview.cardsRevealed', valueKey: 'cards_revealed', icon: '🎴', gradient: 'from-rose-500/20 to-pink-600/20', border: 'border-rose-200/60 dark:border-rose-800/60', iconBg: 'bg-rose-500/20', to: `${basePath}/tirage?tab=list#section-tirages` },
  { key: 'ma_fleur', labelKey: 'statsOverview.maFleur', valueKey: 'fleur_solo_count', icon: '🌸', gradient: 'from-violet-500/20 to-fuchsia-600/20', border: 'border-violet-200/60 dark:border-violet-800/60', iconBg: 'bg-violet-500/20', to: '/mes-fleurs#section-fleurs' },
  { key: 'duo', labelKey: 'statsOverview.duo', valueKey: 'fleur_duo_count', icon: '💕', gradient: 'from-rose-500/20 to-pink-600/20', border: 'border-rose-200/60 dark:border-rose-800/60', iconBg: 'bg-rose-500/20', to: '/mes-fleurs#section-fleurs' },
  { key: 'dreamscape', labelKey: 'statsOverview.dreamscape', valueKey: 'dreamscape_count', icon: '🌙', gradient: 'from-indigo-500/20 to-violet-600/20', border: 'border-indigo-200/60 dark:border-indigo-800/60', iconBg: 'bg-indigo-500/20', to: '/dreamscape/historique' },
]

export function StatsOverview({ stats = {}, className = '' }) {
  useStore((s) => s.locale)
  return (
    <motion.div variants={container} initial="hidden" animate="show" className={`grid grid-cols-2 sm:grid-cols-5 gap-4 ${className}`}>
      {cards.map((c) => (
        <Link key={c.key} href={c.to} className="block min-w-0">
          <motion.div
            variants={item}
            className={`rounded-2xl border backdrop-blur-md min-w-0 overflow-hidden bg-white/60 dark:bg-slate-900/60 ${c.border} bg-gradient-to-br ${c.gradient} p-4 shadow-sm hover:opacity-95 hover:ring-2 hover:ring-violet-400/40 transition-all cursor-pointer`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${c.iconBg}`}>{c.icon}</div>
              <div>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats[c.valueKey] ?? 0}</p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t(c.labelKey)}</p>
              </div>
            </div>
          </motion.div>
        </Link>
      ))}
    </motion.div>
  )
}
