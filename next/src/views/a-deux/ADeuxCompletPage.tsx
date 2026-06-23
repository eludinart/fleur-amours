// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { fleurApi } from '@/api/fleur'
import { aDeuxApi } from '@/api/a-deux'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'
import { AnchorInviteSection } from '@/components/a-deux/AnchorInviteSection'
import { FirstFlowerReveal } from '@/components/a-deux/FirstFlowerReveal'
import { WelcomeExperienceBanner } from '@/components/a-deux/WelcomeExperienceBanner'

const DEFINITION_SLUG = 'fleur-amour-individuel'

function ProgressBar({ answered, total }) {
  const pct = Math.round((answered / total) * 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-500">
        <span>{t('fleur.questionsCount', { answered, total })}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full bg-accent transition-all rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function ADeuxCompletPage() {
  const locale = useStore((s) => s.locale)
  const searchParams = useSearchParams()
  const isWelcome = searchParams?.get('welcome') === '1'
  const [questions, setQuestions] = useState([])
  const [loadingQ, setLoadingQ] = useState(true)
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
    fleurApi
      .getQuestions(DEFINITION_SLUG, locale)
      .then(setQuestions)
      .catch(() => setError(t('fleur.loadQuestionsError')))
      .finally(() => setLoadingQ(false))
  }, [locale])

  const answered = Object.keys(answers).length
  const allDone = questions.length > 0 && answered === questions.length

  function choose(questionId, choice) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { choiceId: choice.id, dimension: choice.dimension, label: choice.label },
    }))
    setCurrentIndex((i) => Math.min(i + 1, questions.length))
  }

  async function submit() {
    if (!allDone) return
    setLoading(true)
    setError('')
    try {
      const answersPayload = Object.entries(answers).map(([qid, a]) => ({
        question_id: parseInt(qid, 10),
        dimension_chosen: a.dimension,
        choice_label: a.label,
      }))
      const res = await aDeuxApi.submitAnchorComplet({ answers: answersPayload })
      setAnchor(res)
      setInviteExpanded(true)
    } catch (e) {
      setError((e as { message?: string })?.message || t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  if (anchor) {
    return (
      <div className="max-w-lg mx-auto py-4 space-y-4">
        <FirstFlowerReveal scores={anchor.scores || {}} onInviteNow={openInviteSection} />
        <AnchorInviteSection
          anchor={{
            id: Number(anchor.id),
            questionnaire_type: 'complet',
            created_at: anchor.created_at,
          }}
          expanded={inviteExpanded}
          onExpandedChange={setInviteExpanded}
        />
      </div>
    )
  }

  if (loadingQ) {
    return <div className="max-w-lg mx-auto py-16 text-center text-slate-500">{t('fleur.loadingQuestions')}</div>
  }

  return (
    <div className="max-w-lg mx-auto space-y-4 py-2">
      {!isWelcome ? (
        <Link href="/a-deux" className="text-sm text-slate-500 underline">← {t('aDeux.hubTitle')}</Link>
      ) : null}
      {isWelcome ? <WelcomeExperienceBanner /> : null}
      <div className="text-center">
        <h2 className="text-xl font-bold">{t('aDeux.completCardTitle')}</h2>
        <p className="text-sm text-slate-500">{t('aDeux.completIntro')}</p>
      </div>
      <ProgressBar answered={answered} total={questions.length} />
      <div className="space-y-3">
        {currentIndex < questions.length && (() => {
          const q = questions[currentIndex]
          const chosen = answers[q.id]
          return (
            <div key={q.id} className="rounded-2xl border p-4 bg-white dark:bg-slate-900">
              <p className="text-sm font-semibold mb-3">
                <span className="text-accent font-mono mr-2">{currentIndex + 1}.</span>
                {q.label}
              </p>
              <div className="space-y-2">
                {q.choices.map((c) => (
                  <label
                    key={c.id}
                    className={`flex items-start gap-3 px-3 py-2 rounded-xl cursor-pointer border ${
                      chosen?.choiceId === c.id ? 'border-accent bg-accent text-white' : 'border-slate-100'
                    }`}
                  >
                    <input type="radio" className="sr-only" checked={chosen?.choiceId === c.id} onChange={() => choose(q.id, c)} />
                    <span className="text-sm">{c.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )
        })()}
      </div>
      {allDone && (
        <button type="button" onClick={submit} disabled={loading} className="w-full py-3 rounded-xl bg-accent text-white font-semibold">
          {loading ? t('fleur.calculating') : t('aDeux.saveAnchor')}
        </button>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
