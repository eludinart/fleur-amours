// @ts-nocheck
'use client'

import { PETAL_DEFS } from '@/lib/petal-theme'

/**
 * Mini-comparaison 8 pétales (vous vs l'autre) — lecture rapide pour la Boussole.
 */
export function BoussolePetalRadar({ comparison = [], compact = false }) {
  if (!comparison?.length) return null
  const byId = Object.fromEntries(comparison.map((c) => [c.id, c]))
  const maxVal = 3

  return (
    <div className={compact ? 'space-y-0.5' : 'space-y-1'}>
      {PETAL_DEFS.map((p) => {
        const row = byId[p.id]
        if (!row) return null
        const v = Math.max(0, Math.min(maxVal, Number(row.visitor ?? 0)))
        const t = Math.max(0, Math.min(maxVal, Number(row.target ?? 0)))
        return (
          <div key={p.id} className="flex items-center gap-1.5">
            <span
              className={`${compact ? 'text-[8px] w-10' : 'text-[9px] w-12'} truncate text-slate-500`}
              title={p.name}
            >
              {p.name.slice(0, compact ? 4 : 6)}
            </span>
            <div className="flex-1 flex items-center gap-0.5 h-2">
              <div className="flex-1 h-full rounded-l-full bg-slate-800 overflow-hidden flex justify-end">
                <div
                  className="h-full rounded-l-full opacity-80"
                  style={{ width: `${(v / maxVal) * 100}%`, backgroundColor: p.color }}
                />
              </div>
              <div className="w-px h-full bg-slate-600/60 shrink-0" />
              <div className="flex-1 h-full rounded-r-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-r-full opacity-90"
                  style={{ width: `${(t / maxVal) * 100}%`, backgroundColor: p.color }}
                />
              </div>
            </div>
          </div>
        )
      })}
      {!compact && (
        <p className="text-[8px] text-slate-500 text-center pt-0.5">
          ← vous · eux →
        </p>
      )}
    </div>
  )
}
