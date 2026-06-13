'use client'

import Link from 'next/link'
import { PETAL_DEFS } from '@/components/FlowerSVG'
import { type ShadowZone } from '@/lib/petal-shadow'
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
}: {
  zones: ShadowZone[]
  hasChronicleShadow: boolean
}) {
  if (zones.length === 0 && !hasChronicleShadow) return null

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

  return (
    <div className="rounded-2xl border border-rose-900/45 bg-gradient-to-br from-rose-950/50 via-slate-950/80 to-slate-950/90 px-4 py-4 mb-5 space-y-4 ring-1 ring-rose-500/15">
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-rose-300/80">{t('fleurZen.shadowTitle')}</p>
        <p className="text-sm sm:text-[15px] text-rose-50/90 leading-relaxed">{intro}</p>
      </div>

      {zones.length > 0 ? (
        <ul className="space-y-2">
          {zones.map((z) => (
            <li
              key={`${z.petalId}-${z.reason}`}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm rounded-lg border border-rose-500/20 bg-rose-950/30 px-3 py-2"
            >
              <span className="font-semibold" style={{ color: petalColor(z.petalId) }}>
                {petalLabel(z.petalId)}
              </span>
              <span className="text-rose-100/55 text-xs">{reasonLabel(z.reason)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="pt-1 border-t border-rose-500/15 space-y-2">
        <p className="text-xs text-rose-100/70 leading-relaxed">{t('fleurZen.shadowProposal')}</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link
            href="/dreamscape"
            className="flex-1 text-center text-xs sm:text-[13px] font-medium rounded-xl border border-indigo-400/35 bg-indigo-950/40 hover:bg-indigo-900/50 text-indigo-100 px-4 py-2.5 transition-colors"
          >
            {t('fleurZen.shadowCtaDreamscape')}
          </Link>
          <Link
            href="/session"
            className="flex-1 text-center text-xs sm:text-[13px] font-medium rounded-xl border border-violet-400/35 bg-violet-950/40 hover:bg-violet-900/50 text-violet-100 px-4 py-2.5 transition-colors"
          >
            <span className="block">{t('fleurZen.shadowCtaExplorer')}</span>
            <span className="block text-[9px] uppercase tracking-wider opacity-70 mt-0.5">{t('layout.phare')}</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
