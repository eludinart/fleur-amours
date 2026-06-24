'use client'

import { FlowerSVG } from '@/components/FlowerSVG'
import { t } from '@/i18n'

/** Aperçu flou de la Fleur post-inscription — teaser visuel sans données réelles. */
const TEASER_PETALS: Record<string, number> = {
  agape: 0.72,
  philautia: 0.45,
  mania: 0.28,
  storge: 0.58,
  pragma: 0.41,
  philia: 0.65,
  ludus: 0.38,
  eros: 0.52,
}

export function LandingFlowerTeaser() {
  return (
    <div className="relative mx-auto mt-8 max-w-sm overflow-hidden rounded-2xl border border-violet-200/70 bg-gradient-to-b from-violet-50/90 to-white/80 p-6 shadow-lg shadow-violet-200/30">
      <p className="text-center font-sans text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-violet-600">
        {t('landing.flowerTeaserLabel')}
      </p>
      <p className="mt-2 text-center font-serif text-sm leading-relaxed text-stone-600">
        {t('landing.flowerTeaserBody')}
      </p>
      <div className="relative mx-auto mt-4 flex justify-center">
        <div className="pointer-events-none select-none blur-[6px] opacity-85 scale-105">
          <FlowerSVG petals={TEASER_PETALS} size={200} animate showLabels={false} showScores={false} />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-white/80 px-4 py-2 text-xs font-semibold text-violet-700 shadow-sm backdrop-blur-sm">
            {t('landing.flowerTeaserUnlock')}
          </span>
        </div>
      </div>
    </div>
  )
}
