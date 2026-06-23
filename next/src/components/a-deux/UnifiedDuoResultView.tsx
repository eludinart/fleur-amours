'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fleurApi } from '@/api/fleur'
import { useAuth } from '@/contexts/AuthContext'
import { useStore } from '@/store/useStore'
import { t } from '@/i18n'
import { FlowerSVG, scoresToPetals } from '@/components/FlowerSVG'
import { FleurInterpretation } from '@/components/FleurInterpretation'
import { DuoJourneyNav } from '@/components/a-deux/DuoJourneyNav'
import { DuoGardenTools } from '@/components/a-deux/DuoGardenTools'
import { DuoPartnerSelector, type DuoPartnerOption } from '@/components/a-deux/DuoPartnerSelector'
import { PETAL_BY_ID } from '@/lib/petal-theme'
import {
  computeDuoAnalysis,
  deriveOperationalSummaryFromDuo,
} from '@/lib/duo-analysis'

function personLabel(person: Record<string, unknown> | null | undefined, fallback: string) {
  if (person?.display_name && String(person.display_name).trim()) return String(person.display_name).trim()
  if (person?.pseudo && String(person.pseudo).trim()) return String(person.pseudo).trim()
  if (person?.email && String(person.email).trim()) return String(person.email).trim()
  if (person?.label && String(person.label).trim()) return String(person.label).trim()
  return fallback
}

function formatScore(v: unknown): string {
  if (typeof v !== 'number') return String(v ?? '—')
  return String(Math.round(v * 10) / 10)
}

function SummaryBlock({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  if (!value?.trim()) return null
  return (
    <div
      className={
        highlight
          ? 'rounded-xl border border-sky-200 bg-sky-50/90 p-4 dark:border-sky-800 dark:bg-sky-950/50'
          : 'rounded-xl border border-slate-200/80 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/50'
      }
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-sky-600 dark:text-sky-300">{label}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-700 dark:text-slate-200">{value}</p>
    </div>
  )
}

export type UnifiedDuoPerson = {
  scores?: Record<string, number>
  display_name?: string
  pseudo?: string
  email?: string
  label?: string
  user_id?: number
}

export type UnifiedDuoResultViewProps = {
  person_a: UnifiedDuoPerson
  person_b?: UnifiedDuoPerson | null
  duo?: ReturnType<typeof computeDuoAnalysis>
  pairingToken: string
  allPairings?: DuoPartnerOption[]
  onReset?: () => void
}

export function UnifiedDuoResultView({
  person_a,
  person_b,
  duo: duoProp,
  pairingToken,
  allPairings = [],
  onReset,
}: UnifiedDuoResultViewProps) {
  const router = useRouter()
  const locale = useStore((s) => s.locale) || 'fr'
  const { user } = useAuth()
  const uid = user?.id != null ? Number(user.id) : null
  const isPersonA = uid && Number(person_a?.user_id) === uid
  const isPersonB = uid && person_b && Number(person_b.user_id) === uid

  const duo = useMemo(
    () => duoProp ?? computeDuoAnalysis(person_a, person_b),
    [duoProp, person_a, person_b]
  )
  const duoScores = duo?.duo ?? {}
  const scoresA = person_a?.scores ?? {}
  const scoresB = person_b?.scores ?? {}

  const derivedSummary = useMemo(
    () => deriveOperationalSummaryFromDuo(duo, locale),
    [duo, locale]
  )
  const summary = derivedSummary

  const [aiExplanation, setAiExplanation] = useState<string | false | null>(null)
  const [flowerSize, setFlowerSize] = useState(280)

  useEffect(() => {
    if (!person_b) return
    fleurApi
      .getDuoExplanation({ person_a, person_b, duo })
      .then((r) => {
        const data = r as { explanation?: string }
        setAiExplanation(data.explanation || t('duo.staticExplanation'))
      })
      .catch(() => setAiExplanation(false))
  }, [person_a, person_b, duo])

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth
      setFlowerSize(w >= 1280 ? 380 : w >= 1024 ? 340 : w >= 640 ? 300 : 260)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const sections = [
    { key: 'stable', labelKey: 'inPhase', color: 'text-emerald-800 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-500' },
    { key: 'adjust', labelKey: 'toAdjust', color: 'text-amber-900 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800', dot: 'bg-amber-500' },
    { key: 'desync', labelKey: 'desync', color: 'text-red-800 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800', dot: 'bg-red-500' },
    { key: 'fragile', labelKey: 'fragileZones', color: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700', dot: 'bg-slate-400' },
  ]

  return (
    <div className="space-y-8 lg:space-y-10" style={{ animation: 'unifiedDuoFade .5s ease' }}>
      <DuoJourneyNav current="duo" />
      <DuoPartnerSelector pairings={allPairings} currentToken={pairingToken} />

      <div className="rounded-xl border border-violet-200 bg-violet-50/80 px-4 py-3 dark:border-violet-900 dark:bg-violet-950/30">
        <p className="text-sm font-medium text-violet-900 dark:text-violet-100">{t('duoJourney.roleUnifiedTitle')}</p>
        <p className="mt-1 text-xs text-violet-800/90 dark:text-violet-200/90">{t('duoJourney.roleUnifiedDesc')}</p>
      </div>

      <header className="text-center lg:text-left space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">
          {t('duoJourney.stepDuoEyebrow')}
        </p>
        <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-50">
          {t('duoResult.titleUnified')}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl">{t('duoResult.subtitleUnified')}</p>
      </header>

      {/* Bloc 1 — Vue d'ensemble visuelle + résumé opérationnel */}
      <div className="grid gap-6 lg:grid-cols-[minmax(260px,420px)_minmax(0,1fr)] lg:gap-8 lg:items-start">
        <div className="flex flex-col items-center lg:items-start lg:sticky lg:top-6 space-y-5">
          <div className="w-full rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/80 p-4 dark:border-slate-700 dark:from-slate-900 dark:to-slate-950/80">
            <p className="text-xs font-medium text-slate-500 mb-1 text-center lg:text-left">{t('duo.twoFlowersOverlay')}</p>
            <p className="text-[10px] text-slate-400 mb-3 text-center lg:text-left">{t('duo.legendAB')}</p>
            <div className="flex justify-center lg:justify-start">
              <FlowerSVG
                petalsA={scoresToPetals(scoresA)}
                petalsB={scoresToPetals(scoresB)}
                size={flowerSize}
                animate
                showLabels
                showScores
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-center lg:justify-start gap-x-4 gap-y-1 text-xs text-slate-500 w-full">
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-rose-500 mr-1" />
              A : {personLabel(person_a, t('duo.personALegend'))}
              {isPersonA ? ` (${t('duo.you')})` : ''}
            </span>
            {person_b ? (
              <span>
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />
                B : {personLabel(person_b, t('duo.personBLegend'))}
                {isPersonB ? ` (${t('duo.you')})` : ''}
              </span>
            ) : null}
          </div>
        </div>

        <section className="rounded-2xl border border-sky-200/90 bg-gradient-to-br from-sky-50/90 via-white to-violet-50/40 p-5 lg:p-6 shadow-sm dark:border-sky-900/60 dark:from-sky-950/30 dark:via-slate-900 dark:to-violet-950/20 space-y-4">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">{t('couple.summaryTitle')}</h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{t('duoResult.summaryLeadQuestionnaire')}</p>
          </div>

          <p className="font-serif text-lg lg:text-xl font-semibold text-sky-950 dark:text-sky-100 leading-snug">
            {summary.headline}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryBlock label={t('couple.summaryClimate')} value={summary.climate} />
            <SummaryBlock label={t('couple.summaryAlignments')} value={summary.alignments} />
            <SummaryBlock label={t('couple.summaryGaps')} value={summary.gaps} />
            <SummaryBlock label={t('couple.summaryNext')} value={summary.nextStep} highlight />
          </div>
        </section>
      </div>

      {/* Bloc 2 — Profils individuels */}
      {person_b ? (
        <section className="space-y-4">
          <h3 className="font-semibold text-base lg:text-lg text-slate-900 dark:text-slate-100">
            {t('duoResult.profilesTitle')}
          </h3>
          <div className="flex flex-wrap justify-center gap-8 lg:gap-12">
            {(
              [
                { person: person_a, role: 'personA' as const, isMe: isPersonA },
                { person: person_b, role: 'personB' as const, isMe: isPersonB },
              ] as const
            ).map(({ person, role, isMe }) => (
              <div key={role} className="text-center">
                <p
                  className={`text-xs font-semibold mb-2 ${
                    role === 'personA' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {t(`duo.${role}`)}{' '}
                  {isMe ? `(${t('duo.you')})` : isPersonA || isPersonB ? `(${t('duo.yourPartner')})` : ''} —{' '}
                  {personLabel(person, t('duo.anonymous'))}
                </p>
                <FlowerSVG
                  petals={scoresToPetals(person.scores)}
                  variant={role === 'personA' ? 'personA' : 'personB'}
                  size={140}
                  animate
                  showLabels
                />
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {[
              [t('duo.personA'), person_a, 'border-rose-200/80 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20', isPersonA],
              [t('duo.personB'), person_b, 'border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20', isPersonB],
            ].map(([label, person, cls, isMe]) => (
              <div key={String(label)} className={`rounded-2xl border p-4 space-y-3 ${cls as string}`}>
                <h4 className="font-semibold text-sm">
                  {String(label)}{' '}
                  {isMe ? `(${t('duo.you')})` : isPersonA || isPersonB ? `(${t('duo.yourPartner')})` : ''} —{' '}
                  {personLabel(person as UnifiedDuoPerson, t('duo.anonymous'))}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {Object.entries((person as UnifiedDuoPerson)?.scores ?? {}).map(([p, v]) => (
                    <div
                      key={p}
                      className="rounded-lg border border-white/60 bg-white/80 dark:bg-slate-900/60 dark:border-slate-700 px-1 py-1.5 text-center text-xs"
                    >
                      <div className="font-bold text-slate-800 dark:text-slate-100">{formatScore(v)}</div>
                      <div className="leading-none text-[10px] text-slate-500">{PETAL_BY_ID[p]?.name ?? p}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Bloc 3 — Interprétation fleur moyenne */}
      <FleurInterpretation compact scores={duoScores} />

      {/* Bloc 4 — Zones comparées A vs B */}
      {person_b ? (
        <section className="space-y-4">
          <div>
            <h3 className="font-semibold text-base lg:text-lg text-slate-900 dark:text-slate-100">
              {t('duoResult.zonesTitle')}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{t('duoResult.zonesLead')}</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 lg:gap-4">
            {sections.map(({ key, labelKey, color, bg, dot }) => {
              const petals = Object.keys(duo?.[key as keyof typeof duo] ?? {})
              if (!petals.length) return null
              return (
                <div key={key} className={`rounded-xl border p-4 ${bg}`}>
                  <p className={`text-xs font-semibold mb-3 flex items-center gap-2 ${color}`}>
                    <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
                    {t(`duo.${labelKey}`)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {petals.map((p) => {
                      const scoreA = formatScore(scoresA[p])
                      const scoreB = formatScore(scoresB[p])
                      return (
                        <div
                          key={p}
                          className="px-2.5 py-2 rounded-lg bg-white/90 dark:bg-slate-900/70 border border-white/60 dark:border-slate-700 text-xs font-medium min-w-[5.5rem]"
                        >
                          <div className="font-semibold text-center text-slate-800 dark:text-slate-100 mb-1">
                            {PETAL_BY_ID[p]?.name ?? p}
                          </div>
                          <div className="flex items-center justify-center gap-1 text-[11px]">
                            <span className="text-rose-700 dark:text-rose-400 font-semibold">{scoreA}</span>
                            <span className="text-slate-400">vs</span>
                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{scoreB}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {/* Bloc 5 — État relationnel narratif */}
      {person_b ? (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 p-5 lg:p-6 space-y-4">
          <h3 className="font-semibold text-base lg:text-lg">{t('duo.relationalState')}</h3>
          {aiExplanation === null ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              {t('duo.generatingExplanation')}
            </div>
          ) : (
            <div className="text-sm lg:text-base leading-relaxed text-slate-700 dark:text-slate-200 text-left space-y-4 max-w-none lg:columns-2 lg:gap-x-8">
              {(aiExplanation || t('duo.staticExplanation'))
                .split(/\n\n+/)
                .filter(Boolean)
                .map((para, i) => (
                  <p key={i} className="whitespace-pre-wrap break-inside-avoid">
                    {para.trim()}
                  </p>
                ))}
            </div>
          )}
        </section>
      ) : null}

      <div id="duo-garden-tools" className="border-t border-slate-200 dark:border-slate-800 pt-8">
        <DuoGardenTools pairingToken={pairingToken} />
      </div>

      <div className="flex gap-3 flex-wrap lg:pt-2 border-t border-slate-200 dark:border-slate-800 pt-6">
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-medium"
          >
            {t('aDeux.newExploration')}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => router.push('/mes-duos')}
          className="px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold"
        >
          {t('aDeux.viewMesDuos')}
        </button>
      </div>

      <style>{`@keyframes unifiedDuoFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}
