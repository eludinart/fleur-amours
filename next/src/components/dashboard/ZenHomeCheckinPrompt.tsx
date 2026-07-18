'use client'

import Link from 'next/link'
import { t } from '@/i18n'
import { PETAL_DEFS } from '@/components/FlowerSVG'

export function ZenHomeCheckinPrompt({
  daysSinceLast,
  baselinePetals,
  currentPetals,
  lastEcho,
}: {
  daysSinceLast: number | null
  baselinePetals?: Record<string, number> | null
  currentPetals?: Record<string, number> | null
  lastEcho?: {
    whisper?: string | null
    highlightPetal?: string | null
    echo?: string | null
  } | null
}) {
  const showDaily = daysSinceLast === null || daysSinceLast >= 1
  if (!showDaily && !lastEcho?.whisper) return null

  const shiftedPetal = (() => {
    if (!baselinePetals || !currentPetals) return null
    let bestId: string | null = null
    let bestDelta = 0
    for (const p of PETAL_DEFS) {
      const base = Number(baselinePetals[p.id] ?? 0)
      const now = Number(currentPetals[p.id] ?? 0)
      const delta = now - base
      if (Math.abs(delta) > Math.abs(bestDelta)) {
        bestDelta = delta
        bestId = p.id
      }
    }
    if (!bestId || Math.abs(bestDelta) < 0.06) return null
    const def = PETAL_DEFS.find((p) => p.id === bestId)
    return { name: def?.name ?? bestId, delta: bestDelta }
  })()

  const echoPetal = lastEcho?.highlightPetal
    ? PETAL_DEFS.find((p) => p.id === lastEcho.highlightPetal)?.name ?? lastEcho.highlightPetal
    : null

  return (
    <div className="mb-5 rounded-2xl border border-sky-500/30 bg-sky-950/25 px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wider text-sky-300/85">
        {t('dashboard.checkinWeeklyLabel')}
      </p>
      {lastEcho?.whisper && !showDaily ? (
        <>
          {echoPetal ? (
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-sky-300/70">{echoPetal}</p>
          ) : null}
          <p className="text-sm text-sky-50/90 mt-1 leading-relaxed italic line-clamp-2">
            {lastEcho.echo || lastEcho.whisper}
          </p>
        </>
      ) : (
        <p className="text-sm text-sky-50/95 mt-1 leading-relaxed">{t('dashboard.checkinWeeklyBody')}</p>
      )}
      {shiftedPetal ? (
        <p className="mt-2 text-xs text-sky-200/75">
          {t('dashboard.checkinBaselineHint', {
            petal: shiftedPetal.name,
            direction: shiftedPetal.delta > 0 ? t('dashboard.checkinRising') : t('dashboard.checkinFalling'),
          })}
        </p>
      ) : null}
      <Link
        href="/checkin"
        className="mt-3 inline-flex rounded-xl border border-sky-400/40 bg-sky-900/40 px-4 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-800/50 transition-colors"
      >
        {t('dashboard.checkinCta')} →
      </Link>
    </div>
  )
}
