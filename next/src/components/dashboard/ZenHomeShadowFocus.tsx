'use client'

import Link from 'next/link'
import { PETAL_DEFS } from '@/components/FlowerSVG'
import { type ShadowZone } from '@/lib/petal-shadow'
import type { CoachGatewayHint } from '@/lib/petal-persistence'
import { t } from '@/i18n'

function petalLabel(id: string): string {
  const key = `fleurZen.petalLabels.${id}`
  const s = t(key)
  return s !== key ? s : PETAL_DEFS.find((p) => p.id === id)?.name ?? id
}

function petalColor(id: string): string | undefined {
  return PETAL_DEFS.find((p) => p.id === id)?.color
}

function reasonLabel(reason: ShadowZone['reason']): string {
  if (reason === 'deficit') return t('fleurZen.shadowReasonDeficit')
  if (reason === 'chronicle') return t('fleurZen.shadowReasonChronicle')
  return t('fleurZen.shadowReasonWeak')
}

export function ZenHomeShadowFocus({
  zones,
  hasChronicleShadow,
  coachGateway,
}: {
  zones: ShadowZone[]
  hasChronicleShadow: boolean
  coachGateway?: CoachGatewayHint | null
}) {
  if (zones.length === 0 && !hasChronicleShadow && !coachGateway) return null

  const petalNames =
    zones.length > 0
      ? zones.map((z) => petalLabel(z.petalId)).join(', ')
      : ''

  const intro =
    zones.length >= 2
      ? t('fleurZen.shadowIntroMulti', { petals: petalNames })
      : zones.length === 1
        ? t('fleurZen.shadowIntroSingle', { petal: petalNames })
        : t('fleurZen.shadowIntroGeneric')

  const coachPetal = coachGateway ? petalLabel(coachGateway.petalId) : ''

  return (
    <div className="rounded-2xl border border-rose-200 dark:border-rose-900/45 bg-gradient-to-br from-rose-50 dark:from-rose-950/50 via-slate-50 dark:via-slate-950/80 to-slate-50 dark:to-slate-950/90 px-4 py-4 mb-5 space-y-4 ring-1 ring-rose-100 dark:ring-rose-500/15">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-rose-700 dark:text-rose-300/80">{t('fleurZen.shadowTitle')}</p>
        <p className="text-sm sm:text-[15px] text-rose-900 dark:text-rose-50/90 leading-relaxed">{intro}</p>
      </div>

      {zones.length > 0 ? (
        <ul className="space-y-2">
          {zones.map((z) => (
            <li
              key={`${z.petalId}-${z.reason}`}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm rounded-lg border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-950/30 px-3 py-2"
            >
              <span className="font-semibold" style={{ color: petalColor(z.petalId) }}>
                {petalLabel(z.petalId)}
              </span>
              <span className="text-rose-700 dark:text-rose-100/55 text-xs">{reasonLabel(z.reason)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {coachGateway ? (
        <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/25 px-3 py-3 space-y-2">
          <p className="text-xs text-amber-900 dark:text-amber-100/90 leading-relaxed">
            {t('dashboard.coachGatewayBody', { petal: coachPetal })}
          </p>
          <Link
            href={`/coaches?petal=${encodeURIComponent(coachGateway.petalId)}`}
            className="inline-flex rounded-xl border border-amber-200 dark:border-amber-400/40 bg-amber-100 dark:bg-amber-900/40 px-4 py-2 text-xs font-semibold text-amber-900 dark:text-amber-100 hover:bg-amber-200 dark:hover:bg-amber-800/50 transition-colors"
          >
            {t('dashboard.coachGatewayCta')} →
          </Link>
        </div>
      ) : null}

      <div className="pt-1 border-t border-rose-200 dark:border-rose-500/15 space-y-2">
        <p className="text-xs text-rose-700 dark:text-rose-100/70 leading-relaxed">{t('fleurZen.shadowProposal')}</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link
            href="/dreamscape"
            className="flex-1 text-center text-xs sm:text-[13px] font-medium rounded-xl border border-indigo-200 dark:border-indigo-400/35 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-900 dark:text-indigo-100 px-4 py-2.5 transition-colors"
          >
            {t('fleurZen.shadowCtaDreamscape')}
          </Link>
          <Link
            href="/session"
            className="flex-1 text-center text-xs sm:text-[13px] font-medium rounded-xl border border-violet-200 dark:border-violet-400/35 bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-900/50 text-violet-900 dark:text-violet-100 px-4 py-2.5 transition-colors"
          >
            <span className="block">{t('fleurZen.shadowCtaExplorer')}</span>
            <span className="block text-xs uppercase tracking-wider opacity-70 mt-0.5">{t('layout.phare')}</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
