'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { fleurApi } from '@/api/fleur'
import { useAuth } from '@/contexts/AuthContext'
import { useStore } from '@/store/useStore'
import { t } from '@/i18n'
import { FlowerSVG, scoresToPetals } from '@/components/FlowerSVG'
import { FleurInterpretation } from '@/components/FleurInterpretation'
import { computeDuoAnalysis } from '@/lib/duo-analysis'

const PETAL_LABELS: Record<string, string> = {
  agape: 'Agapè',
  philautia: 'Philautia',
  mania: 'Mania',
  storge: 'Storgè',
  pragma: 'Pragma',
  philia: 'Philia',
  ludus: 'Ludus',
  eros: 'Éros',
}

const ZONE_COLOR: Record<string, string> = {
  active: 'bg-accent/10 text-accent border-accent/20',
  retrait: 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700',
  neutre: 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-100 dark:border-slate-800',
}

function personLabel(person: Record<string, unknown> | null | undefined, fallback: string) {
  if (person?.display_name && String(person.display_name).trim()) return String(person.display_name).trim()
  if (person?.pseudo && String(person.pseudo).trim()) return String(person.pseudo).trim()
  if (person?.email && String(person.email).trim()) return String(person.email).trim()
  return fallback
}

type DuoSynthesisViewProps = {
  duoData: {
    person_a: Record<string, unknown>
    person_b?: Record<string, unknown>
    duo?: ReturnType<typeof computeDuoAnalysis>
    invite_token?: string
    invited_email?: string | null
  }
  onReset?: () => void
}

export function DuoSynthesisView({ duoData, onReset }: DuoSynthesisViewProps) {
  const router = useRouter()
  const { user } = useAuth()
  useStore((s) => s.locale)
  const { person_a, person_b } = duoData
  const uid = user?.id != null ? Number(user.id) : null
  const isPersonA = uid && Number(person_a?.user_id) === uid
  const isPersonB = uid && person_b && Number(person_b.user_id) === uid
  const duo = duoData.duo ?? computeDuoAnalysis(
    person_a as { scores?: Record<string, number> },
    person_b as { scores?: Record<string, number> }
  )
  const duoScores = duo?.duo ?? {}
  const [aiExplanation, setAiExplanation] = useState<string | false | null>(null)

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

  const sections = [
    { key: 'stable', labelKey: 'inPhase', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800' },
    { key: 'adjust', labelKey: 'toAdjust', color: 'text-amber-800 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-950 border-amber-200 dark:border-amber-800' },
    { key: 'desync', labelKey: 'desync', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800' },
    { key: 'fragile', labelKey: 'fragileZones', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
  ]

  const scoresA = (person_a?.scores ?? {}) as Record<string, number>
  const scoresB = (person_b?.scores ?? {}) as Record<string, number>

  return (
    <div className="space-y-6" style={{ animation: 'fadeIn .5s ease' }}>
      <h2 className="text-2xl font-bold text-center">{t('aDeux.synthesisTitle')} 🌸💞🌸</h2>

      <div className="flex flex-col items-center">
        <p className="text-xs font-medium text-slate-500 mb-1">{t('duo.twoFlowersOverlay')}</p>
        <p className="text-[10px] text-slate-400 mb-2">{t('duo.legendAB')}</p>
        <FlowerSVG
          petalsA={scoresToPetals(scoresA)}
          petalsB={scoresToPetals(scoresB)}
          size={240}
          animate
          showLabels
          showScores
        />
      </div>

      <FleurInterpretation compact scores={duoScores} />

      <div className="grid sm:grid-cols-2 gap-4">
        {[
          [t('duo.personA'), person_a, 'border-accent/30 bg-accent/5', isPersonA],
          [t('duo.personB'), person_b, 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30', isPersonB],
        ].map(([label, person, cls, isMe]) => (
          <div key={String(label)} className={`rounded-2xl border p-4 space-y-3 ${cls as string}`}>
            <h4 className="font-semibold text-sm">
              {String(label)}{' '}
              {isMe ? `(${t('duo.you')})` : isPersonA || isPersonB ? `(${t('duo.yourPartner')})` : ''} —{' '}
              {personLabel(person as Record<string, unknown>, t('duo.anonymous'))}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
              {Object.entries((person as Record<string, unknown>)?.scores as Record<string, number> ?? {}).map(
                ([p, v]) => (
                  <div
                    key={p}
                    className={`rounded-lg border px-1 py-1 text-center text-xs ${ZONE_COLOR.neutre}`}
                  >
                    <div className="font-bold">{typeof v === 'number' ? Math.round(v * 10) / 10 : v}</div>
                    <div className="leading-none text-[10px]">{PETAL_LABELS[p] ?? p}</div>
                  </div>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 p-5 space-y-4">
        <h4 className="font-semibold text-base">{t('duo.relationalState')}</h4>
        {aiExplanation === null ? (
          <p className="text-sm text-slate-500">{t('duo.generatingExplanation')}</p>
        ) : (
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
            {aiExplanation || t('duo.staticExplanation')}
          </p>
        )}
      </div>

      {sections.map(({ key, labelKey, color, bg }) => {
        const petals = Object.keys(duo?.[key as keyof typeof duo] ?? {})
        if (!petals.length) return null
        return (
          <div key={key} className={`rounded-xl border p-4 ${bg}`}>
            <p className={`text-xs font-semibold mb-2 ${color}`}>{t(`duo.${labelKey}`)}</p>
            <div className="flex flex-wrap gap-2">
              {petals.map((p) => (
                <span key={p} className="text-xs px-2 py-1 rounded-full bg-white/60 dark:bg-slate-900/40">
                  {PETAL_LABELS[p] ?? p}
                </span>
              ))}
            </div>
          </div>
        )
      })}

      <div className="rounded-2xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-5 space-y-3">
        <h3 className="font-semibold text-violet-900 dark:text-violet-100">{t('aDeux.coupleGardenTitle')}</h3>
        <p className="text-sm text-violet-800/90 dark:text-violet-200/90">{t('aDeux.coupleGardenDesc')}</p>
        <Link
          href={
            duoData.invited_email
              ? `/couple?invite_email=${encodeURIComponent(String(duoData.invited_email))}`
              : '/couple'
          }
          className="inline-flex px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700"
        >
          {t('aDeux.coupleGardenCta')}
        </Link>
      </div>

      <div className="flex gap-3 flex-wrap">
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-medium"
          >
            {t('aDeux.newExploration')}
          </button>
        )}
        <button
          type="button"
          onClick={() => router.push('/mes-duos')}
          className="px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold"
        >
          {t('aDeux.viewMesDuos')}
        </button>
      </div>
    </div>
  )
}
