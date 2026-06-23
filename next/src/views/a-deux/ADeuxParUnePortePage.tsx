// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { fleurBetaApi } from '@/api/fleur-beta'
import { aDeuxApi } from '@/api/a-deux'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'
import { FOUR_DOORS } from '@/data/tarotCards'
import { FlowerSVG, scoresToPetals } from '@/components/FlowerSVG'
import { AnchorInviteSection } from '@/components/a-deux/AnchorInviteSection'
import { FirstFlowerReveal } from '@/components/a-deux/FirstFlowerReveal'
import { WelcomeExperienceBanner } from '@/components/a-deux/WelcomeExperienceBanner'
import {
  FLEUR_BETA_CHOICE_VALUES,
  isFleurBetaDoorKey,
  type FleurBetaDoorKey,
} from '@/lib/fleur-beta-data'

const CHOICE_LABEL_KEYS = ['fleurBeta.choice0', 'fleurBeta.choice1', 'fleurBeta.choice2', 'fleurBeta.choice3']

function ProgressBar({ answered, total }) {
  const pct = Math.round((answered / total) * 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-500">
        <span>{answered} / {total}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full bg-accent transition-all rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function ADeuxParUnePortePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteOnly = searchParams?.get('invite') === '1'
  const anchorIdParam = searchParams?.get('anchor')
  const isWelcome = searchParams?.get('welcome') === '1'

  const [step, setStep] = useState(() => (inviteOnly && anchorIdParam ? 'invite' : 'porte'))
  const [porte, setPorte] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loadingQ, setLoadingQ] = useState(false)
  const [answers, setAnswers] = useState({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [anchor, setAnchor] = useState(null)
  const [inviteExpanded, setInviteExpanded] = useState(true)

  function openInviteSection() {
    setInviteExpanded(true)
    requestAnimationFrame(() => {
      document.getElementById('anchor-invite')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  useEffect(() => {
    if (inviteOnly && anchorIdParam) {
      aDeuxApi.getAnchor(Number(anchorIdParam)).then(setAnchor).catch(() => setError(t('aDeux.loadError')))
    }
  }, [inviteOnly, anchorIdParam])

  function loadQuestionsForPorte(p) {
    setLoadingQ(true)
    fleurBetaApi
      .getQuestions(p)
      .then((data) => {
        setQuestions(data.questions || [])
        setPorte(p)
        setStep('quiz')
        setAnswers({})
        setCurrentIndex(0)
      })
      .catch(() => setError(t('fleur.loadQuestionsError')))
      .finally(() => setLoadingQ(false))
  }

  const answered = Object.keys(answers).length
  const allDone = questions.length > 0 && answered === questions.length

  function choose(questionId, value, choiceIndex) {
    setAnswers((prev) => ({ ...prev, [questionId]: { value, choiceIndex } }))
    setCurrentIndex((i) => Math.min(i + 1, questions.length))
  }

  async function submit() {
    if (!porte || !allDone) return
    setLoading(true)
    setError('')
    try {
      const answersPayload = questions.map((q) => ({
        questionId: q.id,
        value: answers[q.id]?.value ?? 0,
      }))
      const res = await aDeuxApi.submitAnchorPorte({ porte, answers: answersPayload })
      setAnchor({ ...res, porte, scores: res.scores })
      setStep('result')
      setInviteExpanded(true)
    } catch (e) {
      setError((e as { message?: string })?.message || t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  if (step === 'invite' && anchor) {
    return (
      <div className="max-w-lg mx-auto py-4 space-y-4">
        <Link href="/a-deux" className="text-sm text-slate-500 underline">← {t('aDeux.hubTitle')}</Link>
        <AnchorInviteSection
          anchor={{
            id: Number(anchor.id || anchorIdParam),
            questionnaire_type: anchor.questionnaire_type || 'porte',
            porte: anchor.porte,
            created_at: anchor.created_at,
          }}
          defaultExpanded
        />
      </div>
    )
  }

  if (step === 'result' && anchor) {
    const scores = anchor.scores || {}
    return (
      <div className="max-w-lg mx-auto py-4 space-y-4">
        <FirstFlowerReveal scores={scores} onInviteNow={openInviteSection} />
        <AnchorInviteSection
          anchor={{
            id: Number(anchor.id),
            questionnaire_type: 'porte',
            porte: anchor.porte || porte,
            created_at: anchor.created_at,
          }}
          expanded={inviteExpanded}
          onExpandedChange={setInviteExpanded}
        />
      </div>
    )
  }

  if (step === 'porte') {
    return (
      <div className="max-w-lg mx-auto space-y-6 py-4">
        {!isWelcome ? (
          <Link href="/a-deux" className="text-sm text-slate-500 underline">← {t('aDeux.hubTitle')}</Link>
        ) : null}
        {isWelcome ? <WelcomeExperienceBanner /> : null}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">{t('fleurBeta.doorTitle')}</h2>
          <p className="text-sm text-slate-500">{t('aDeux.porteIntro')}</p>
        </div>
        <div className="grid gap-3">
          {FOUR_DOORS.map((d) => (
            <button
              key={d.key}
              type="button"
              disabled={loadingQ}
              onClick={() => isFleurBetaDoorKey(d.key) && loadQuestionsForPorte(d.key)}
              className={`rounded-2xl border-2 p-4 text-left transition-all hover:scale-[1.01] ${d.border} bg-white dark:bg-slate-900`}
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{d.aspect}</span>
              <p className="font-bold text-lg mt-1">{d.subtitle}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">{d.title}</p>
            </button>
          ))}
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-4 py-2">
      <ProgressBar answered={answered} total={questions.length} />
      <div className="space-y-3">
        {currentIndex < questions.length && (() => {
          const q = questions[currentIndex]
          const chosen = answers[q.id]
          return (
            <div key={q.id} className="rounded-2xl border p-4 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <p className="text-sm font-semibold mb-3">
                <span className="text-accent font-mono mr-2">{currentIndex + 1}.</span>
                {q.text}
              </p>
              <div className="space-y-2">
                {FLEUR_BETA_CHOICE_VALUES.map((val, idx) => {
                  const isChosen = chosen?.choiceIndex === idx
                  return (
                    <label
                      key={idx}
                      className={`flex items-start gap-3 px-3 py-2.5 rounded-xl cursor-pointer border ${
                        isChosen ? 'border-accent bg-accent text-white' : 'border-slate-100 dark:border-slate-800'
                      }`}
                    >
                      <input type="radio" className="sr-only" checked={isChosen} onChange={() => choose(q.id, val, idx)} />
                      <span className="text-sm">{t(CHOICE_LABEL_KEYS[idx])}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>
      {allDone && (
        <button type="button" onClick={submit} disabled={loading} className="w-full py-3 rounded-xl bg-accent text-white font-semibold disabled:opacity-60">
          {loading ? t('fleur.calculating') : t('aDeux.saveAnchor')}
        </button>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
