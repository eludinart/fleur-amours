'use client'

import { PETAL_DEFS } from '@/components/FlowerSVG'
import { PETAL_ORDER } from '@/lib/petal-tarot'
import { t } from '@/i18n'

function petalLabel(id: string): string {
  const key = `fleurZen.petalLabels.${id}`
  const s = t(key)
  return s !== key ? s : PETAL_DEFS.find((p) => p.id === id)?.name ?? id
}

export function ZenPetalLegend({ petals }: { petals: Record<string, number> }) {
  return (
    <div className="w-full rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-slate-950/40 px-3 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-white/70 mb-2.5 text-center">
        {t('fleurZen.petalLegendTitle')}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2">
        {PETAL_ORDER.map((id) => {
          const pct = Math.round(Math.min(1, Math.max(0, Number(petals[id] ?? 0))) * 100)
          const color = PETAL_DEFS.find((p) => p.id === id)?.color
          return (
            <div key={id} className="flex items-center justify-between gap-1 text-xs min-w-0">
              <span className="truncate font-medium" style={{ color: color ?? undefined }}>
                {petalLabel(id)}
              </span>
              <span className="tabular-nums text-slate-500 dark:text-white/55 shrink-0">{pct} %</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
