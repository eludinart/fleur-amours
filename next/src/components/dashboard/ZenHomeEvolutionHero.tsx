'use client'

import Link from 'next/link'
import { FlowerSVG, PETAL_DEFS } from '@/components/FlowerSVG'
import { FleurTimeScroll, formatZenSnapshotDate } from '@/components/fleur/FleurTimeScroll'
import { t } from '@/i18n'

type Snapshot = {
  id: string
  date?: string
  label: string
  type?: string
}

export function ZenHomeEvolutionHero({
  petals,
  snapshots,
  timeIndex,
  onTimeSelect,
  onResumeAuto,
  autoTimePlay,
  reduceMotion,
  whisper,
  whisperSubhint,
  pulseId,
  labelAnchorIds,
  onPetalClick,
  clickablePetalsFilter,
  timeStateCaption,
  accentPetalName,
  accentPetalColor,
  locale,
}: {
  petals: Record<string, number>
  snapshots: Snapshot[]
  timeIndex: number
  onTimeSelect: (index: number) => void
  onResumeAuto: () => void
  autoTimePlay: boolean
  reduceMotion: boolean | null
  whisper: string | null
  whisperSubhint: string
  pulseId: string | null
  labelAnchorIds: string[]
  onPetalClick: (petalId: string) => void
  clickablePetalsFilter: Set<string> | null
  timeStateCaption: {
    mode: string
    text?: string
    date?: string
    detail?: string
    petalName?: string
  }
  accentPetalName: string
  accentPetalColor: string | null
  locale: string
}) {
  return (
    <section className="mb-8 rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-6 sm:px-6 sm:py-8 backdrop-blur-sm">
      <div className="text-center mb-5 space-y-2">
        <p className="text-[10px] uppercase tracking-[0.25em] text-violet-300/80">{t('fleurZen.evolutionTitle')}</p>
        {whisper ? (
          <div className="mx-auto max-w-2xl space-y-1">
            <p className="text-[9px] uppercase tracking-wider text-violet-300/55">{whisperSubhint}</p>
            <p className="text-base sm:text-lg font-light text-violet-100/95 leading-relaxed italic">{whisper}</p>
          </div>
        ) : snapshots.length >= 2 ? (
          <p className="text-sm text-white/45">{t('fleurZen.readingLevel3HintTrend')}</p>
        ) : null}
      </div>

      <div className="flex flex-col items-center gap-5">
        <div className="relative flex justify-center w-full isolate [&_.flower-svg]:max-w-[min(100%,340px)]">
          <div
            className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(100%,320px)] aspect-square rounded-full bg-gradient-to-tr from-violet-600/35 via-teal-500/22 to-fuchsia-600/28 blur-3xl ${
              reduceMotion ? 'opacity-70' : 'opacity-95 motion-safe:animate-[pulse_5s_ease-in-out_infinite]'
            }`}
            aria-hidden
          />
          <FlowerSVG
            petals={petals}
            size={320}
            animate
            showLabels
            showScores
            labelsOnHoverOnly
            pinnedLabelIds={labelAnchorIds}
            labelTheme="dark"
            labelPeekMs={2800}
            visualPreset="zen"
            historicalView={timeIndex >= 0}
            pulsePetalId={pulseId}
            disablePulse={!!reduceMotion}
            onPetalClick={onPetalClick}
            clickablePetals={clickablePetalsFilter}
            svgClassName="relative z-[1] mx-auto"
          />
        </div>

        <div className="w-full max-w-lg rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-center">
          <p className="text-[10px] uppercase tracking-[0.2em] text-violet-300/75">{t('fleurZen.snapshotLabel')}</p>
          <div className="mt-1.5 text-sm text-violet-50/95 leading-relaxed" aria-live="polite">
            {timeStateCaption.mode === 'present' ? (
              <p>{timeStateCaption.text}</p>
            ) : timeStateCaption.mode === 'snapshot' ? (
              <>
                <p className="text-xs text-white/45">{timeStateCaption.date}</p>
                <p>{timeStateCaption.detail}</p>
              </>
            ) : timeStateCaption.mode === 'petalOnly' ? (
              <p>{t('fleurZen.timeCaptionSnapshotPetal', { date: timeStateCaption.date ?? '', petal: timeStateCaption.petalName ?? '' })}</p>
            ) : (
              <p>{t('fleurZen.timeCaptionSnapshotDate', { date: timeStateCaption.date ?? '' })}</p>
            )}
          </div>
          {accentPetalName ? (
            <p className="mt-2 text-sm font-semibold" style={accentPetalColor ? { color: accentPetalColor } : undefined}>
              {t('fleurZen.accentOnView', { petal: accentPetalName })}
            </p>
          ) : null}
        </div>

        {snapshots.length > 0 ? (
          <FleurTimeScroll
            snapshots={snapshots}
            selectedIndex={timeIndex}
            onSelect={onTimeSelect}
            variant="full"
            showResumeAuto={!autoTimePlay && !reduceMotion}
            onResumeAuto={onResumeAuto}
            className="!max-w-lg w-full"
          />
        ) : null}
      </div>

      <div className="mt-5 flex justify-center">
        <Link
          href="/eclosion"
          className="text-xs font-medium text-teal-300/90 hover:text-teal-200 border border-teal-500/35 px-4 py-2 rounded-full transition-colors"
        >
          {t('dashboard.eclosionHubCta')} →
        </Link>
      </div>
    </section>
  )
}
