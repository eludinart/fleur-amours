// @ts-nocheck
'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { InfoBubble } from '@/components/InfoBubble'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

function formatDate(s: string) {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function ChronicleList({ chronicle = [], className = '' }) {
  useStore((s) => s.locale)
  if (!chronicle.length) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className={`rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 p-6 ${className}`}
      >
        <div className="flex items-center gap-1.5 mb-4">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t('chronicle.title')}</h3>
          <InfoBubble title={t('chronicle.title')} content={t('chronicle.desc')} />
        </div>
        <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-500">
          <span className="text-4xl mb-2">📜</span>
          <p className="text-sm text-center">{t('chronicle.empty')}</p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className={`rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 p-6 ${className}`}
    >
      <div className="flex items-center gap-1.5 mb-4">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t('chronicle.title')}</h3>
        <InfoBubble title={t('chronicle.title')} content={t('chronicle.desc')} />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t('chronicle.desc')}</p>
      <ul className="space-y-3 max-h-96 overflow-y-auto overflow-x-hidden">
        {chronicle.map((item, i) => (
          <motion.li key={`${item.type}-${item.id}-${i}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}>
            {item.type === 'session' || item.type === 'session_anchor' ? (
              <Link
                href={`/session/${item.id}`}
                className="block rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 p-3 hover:border-accent/40 hover:bg-accent/5 dark:hover:bg-accent/10 transition-colors min-w-0"
              >
                <p className="text-sm text-slate-700 dark:text-slate-200 italic break-words whitespace-pre-wrap">&quot;{item.synthesis}&quot;</p>
                <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                  <span>🌿</span> {t('chronicle.session')} · {formatDate(item.created_at)}
                </p>
              </Link>
            ) : item.type === 'dreamscape' ? (
              <Link
                href="/dreamscape/historique"
                className="block rounded-xl border border-slate-200 dark:border-slate-700 bg-violet-50/60 dark:bg-violet-950/30 p-3 hover:border-violet-400/40 hover:bg-violet-50/80 dark:hover:bg-violet-950/50 transition-colors min-w-0"
              >
                <p className="text-sm text-slate-700 dark:text-slate-200 italic break-words whitespace-pre-wrap">&quot;{item.synthesis}&quot;</p>
                <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                  <span>🌙</span> {t('chronicle.dreamscape')} · {formatDate(item.created_at)}
                </p>
              </Link>
            ) : (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 p-3 min-w-0">
                <p className="text-sm text-slate-700 dark:text-slate-200 italic break-words whitespace-pre-wrap">&quot;{item.synthesis}&quot;</p>
                <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                  <span>🎴</span> {t('chronicle.tirage')} · {formatDate(item.created_at)}
                </p>
              </div>
            )}
          </motion.li>
        ))}
      </ul>
    </motion.div>
  )
}
