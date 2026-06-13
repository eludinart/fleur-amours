'use client'

import Link from 'next/link'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

const MINI_CARDS = [
  { key: 'sessions', labelKey: 'statsOverview.sessions', valueKey: 'sessions_count', icon: '⏳', to: '/session#section-sessions' },
  { key: 'cards', labelKey: 'statsOverview.cardsRevealed', valueKey: 'cards_revealed', icon: '🎴', to: '/tirage?tab=list#section-tirages' },
  { key: 'ma_fleur', labelKey: 'statsOverview.maFleur', valueKey: 'fleur_solo_count', icon: '🌸', to: '/mes-fleurs#section-fleurs' },
  { key: 'dreamscape', labelKey: 'statsOverview.dreamscape', valueKey: 'dreamscape_count', icon: '🌙', to: '/dreamscape/historique' },
] as const

export function ZenHomeMiniStats({ stats = {} }: { stats?: Record<string, unknown> }) {
  useStore((s) => s.locale)
  const total = MINI_CARDS.reduce((n, c) => n + Number(stats[c.valueKey] ?? 0), 0)
  if (total === 0) return null

  return (
    <div className="w-full space-y-2">
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 text-center xl:text-left">
        {t('fleurZen.miniStatsTitle')}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {MINI_CARDS.map((c) => {
          const v = Number(stats[c.valueKey] ?? 0)
          if (v === 0) return null
          return (
            <Link
              key={c.key}
              href={c.to}
              className="rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] px-3 py-2.5 transition-colors min-w-0"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg shrink-0" aria-hidden>
                  {c.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-white/90 leading-none">{v}</p>
                  <p className="text-[10px] text-white/45 truncate">{t(c.labelKey)}</p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
