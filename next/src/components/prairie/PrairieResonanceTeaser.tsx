'use client'

import Link from 'next/link'
import { PETAL_DEFS } from '@/components/FlowerSVG'
import { t } from '@/i18n'

export function PrairieResonanceTeaser({
  count,
  petalId,
}: {
  count: number
  petalId: string
}) {
  if (count <= 0) return null

  const petal = PETAL_DEFS.find((p) => p.id === petalId)
  const petalName = petal?.name ?? petalId

  return (
    <div className="mb-4 rounded-2xl border border-cyan-500/35 bg-gradient-to-r from-cyan-950/50 to-slate-950/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-cyan-50/95 leading-relaxed">
        {t('prairie.resonanceTeaser', { count, petal: petalName })}
      </p>
      <Link
        href="/prairie"
        className="shrink-0 rounded-full border border-cyan-400/40 bg-cyan-900/40 px-4 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-800/50 transition-colors"
      >
        {t('prairie.resonanceTeaserCta')} →
      </Link>
    </div>
  )
}
