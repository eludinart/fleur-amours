'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { myceliumApi, type MyceliumInterviewDTO, type MyceliumInterviewTopicDTO, type InterviewAiTurnDTO } from '@/api/mycelium'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

type Phase = 'topics' | 'chat' | 'closing'

const MOOD_SCALE = [1, 2, 3, 4, 5]

type Props = {
  onPulseSaved?: () => void
}

export function MyceliumWellbeingInterview({ onPulseSaved }: Props) {
  const locale = useStore((s) => s.locale) || 'fr'
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [topics, setTopics] = useState<MyceliumInterviewTopicDTO[]>([])
  const [session, setSession] = useState<MyceliumInterviewDTO | null>(null)
  const [phase, setPhase] = useState<Phase>('topics')
  const [draft, setDraft] = useState('')
  const [pendingClose, setPendingClose] = useState<InterviewAiTurnDTO | null>(null)
  const [closingMood, setClosingMood] = useState(3)
  const [closingNote, setClosingNote] = useState('')
  const [saved, setSaved] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const reload = useCallback(() => {
    setLoading(true)
    setError('')
    myceliumApi
      .interviewState()
      .then((r) => {
        setTopics(r.topics || [])
        if (r.active?.status === 'in_progress') {
          setSession(r.active)
          setPhase('chat')
        }
      })
      .catch((e) => setError((e as { message?: string })?.message || t('mycelium.error')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [session?.messages.length, phase])

  async function startTopic(slug: string) {
    setBusy(true)
    setError('')
    setSaved(false)
    try {
      const r = await myceliumApi.interviewStart(slug, locale)
      setSession(r.session)
      setPendingClose(null)
      setPhase('chat')
      setDraft('')
    } catch (e) {
      setError((e as { message?: string })?.message || t('mycelium.error'))
    } finally {
      setBusy(false)
    }
  }

  async function sendReply() {
    if (!session || !draft.trim()) return
    setBusy(true)
    setError('')
    const text = draft.trim()
    setDraft('')
    try {
      const r = await myceliumApi.interviewReply(session.id, text, locale)
      setSession(r.session)
      if (r.turn.proposeClose) {
        setPendingClose(r.turn)
        setClosingMood(r.turn.suggestedMood ?? 3)
        setClosingNote(r.turn.pulseNote || r.turn.employeeSummary || '')
        setPhase('closing')
      }
    } catch (e) {
      setError((e as { message?: string })?.message || t('mycelium.error'))
      setDraft(text)
    } finally {
      setBusy(false)
    }
  }

  async function completeInterview() {
    if (!session) return
    setBusy(true)
    setError('')
    try {
      await myceliumApi.interviewComplete(session.id, {
        mood: closingMood,
        note: closingNote.trim() || undefined,
        locale,
      })
      setSaved(true)
      setSession(null)
      setPendingClose(null)
      setPhase('topics')
      onPulseSaved?.()
      reload()
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError((e as { message?: string })?.message || t('mycelium.error'))
    } finally {
      setBusy(false)
    }
  }

  async function cancelInterview() {
    if (session) {
      try {
        await myceliumApi.interviewAbandon(session.id)
      } catch {
        /* ignore */
      }
    }
    setSession(null)
    setPendingClose(null)
    setPhase('topics')
    setDraft('')
    reload()
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" aria-hidden />
      </div>
    )
  }

  return (
    <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white p-5 shadow-sm dark:border-violet-900 dark:from-violet-950/30 dark:to-slate-900">
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">
          {t('mycelium.interview.badge')}
        </p>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('mycelium.interview.title')}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('mycelium.interview.lead')}</p>
      </div>

      <p className="mb-4 rounded-lg border border-violet-100 bg-white/70 px-3 py-2 text-xs text-violet-900 dark:border-violet-800 dark:bg-slate-900/50 dark:text-violet-200">
        {t('mycelium.interview.privacy')}
      </p>

      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      )}

      {saved && (
        <p className="mb-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">{t('mycelium.interview.saved')}</p>
      )}

      {phase === 'topics' && (
        <div className="grid gap-2 sm:grid-cols-2">
          {topics.map((topic) => (
            <button
              key={topic.slug}
              type="button"
              disabled={busy}
              onClick={() => startTopic(topic.slug)}
              className="rounded-xl border border-violet-200 bg-white px-4 py-3 text-left transition hover:border-violet-400 hover:shadow-md disabled:opacity-60 dark:border-violet-800 dark:bg-slate-900 dark:hover:border-violet-600"
            >
              <p className="font-semibold text-slate-900 dark:text-slate-100">{t(topic.labelKey)}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t(topic.introKey)}</p>
            </button>
          ))}
        </div>
      )}

      {phase === 'chat' && session && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-violet-800 dark:text-violet-200">{session.topicLabel}</p>
            <button
              type="button"
              onClick={cancelInterview}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              {t('mycelium.interview.cancel')}
            </button>
          </div>

          <div
            ref={scrollRef}
            className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950"
          >
            {session.messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <p className="text-xs text-slate-400 animate-pulse">{t('mycelium.interview.thinking')}</p>
            )}
          </div>

          <div className="flex gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder={t('mycelium.interview.placeholder')}
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void sendReply()
                }
              }}
              className="flex-1 rounded-xl border border-slate-300 bg-white p-3 text-sm focus:border-violet-400 focus:outline-none disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={sendReply}
              disabled={busy || !draft.trim()}
              className="shrink-0 self-end rounded-full bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {t('mycelium.interview.send')}
            </button>
          </div>
        </div>
      )}

      {phase === 'closing' && session && (
        <div className="space-y-4">
          {pendingClose?.employeeSummary && (
            <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {pendingClose.employeeSummary}
            </p>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-800 dark:text-slate-100">
              {t('mycelium.interview.closingMood')}
            </label>
            <div className="flex gap-2">
              {MOOD_SCALE.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setClosingMood(n)}
                  className={`h-10 flex-1 rounded-xl border text-sm font-semibold ${
                    closingMood === n
                      ? 'border-emerald-500 bg-emerald-600 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-800'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-800 dark:text-slate-100">
              {t('mycelium.interview.closingNote')}
            </label>
            <textarea
              value={closingNote}
              onChange={(e) => setClosingNote(e.target.value)}
              rows={3}
              placeholder={t('mycelium.interview.closingNotePlaceholder')}
              className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            <p className="mt-1 text-xs text-slate-500">{t('mycelium.interview.closingNoteHint')}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={completeInterview}
              disabled={busy}
              className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {busy ? '…' : t('mycelium.interview.savePulse')}
            </button>
            <button
              type="button"
              onClick={() => setPhase('chat')}
              disabled={busy}
              className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:border-slate-600 dark:text-slate-300"
            >
              {t('mycelium.interview.continueChat')}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
