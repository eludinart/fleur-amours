'use client'

import { MATURITY_BADGE_DEFS, type MaturityBadgeId } from '@/lib/community-maturity-data'
import { t } from '@/i18n'

/**
 * Badges de maturité communautaire (progression douce).
 */
export function MaturityBadges({
  badges = [],
  compact = false,
  className = '',
}: {
  badges?: string[]
  compact?: boolean
  className?: string
}) {
  if (!badges?.length) return null
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {badges.map((id) => {
        const def = MATURITY_BADGE_DEFS[id as MaturityBadgeId]
        if (!def) return null
        return (
          <span
            key={id}
            className={`inline-flex items-center gap-0.5 rounded-md border border-slate-200 dark:border-slate-600/40 bg-slate-100 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 ${
              compact ? 'px-1 py-0.5 text-[9px]' : 'px-1.5 py-0.5 text-[10px]'
            }`}
            title={t(def.descKey)}
          >
            <span aria-hidden>{def.emoji}</span>
            <span>{t(def.labelKey)}</span>
          </span>
        )
      })}
    </div>
  )
}
