'use client'

import { useCallback, useEffect, useState } from 'react'
import { aDeuxApi } from '@/api/a-deux'
import type { DyadEventDTO, DyadRitualDTO } from '@/api/dyads'
import { dyadsApi, type MediationDTO } from '@/api/dyads'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

type DuoGardenToolsProps = {
  pairingToken: string
}

export function DuoGardenTools({ pairingToken }: DuoGardenToolsProps) {
  const locale = useStore((s) => s.locale) || 'fr'
  const [events, setEvents] = useState<DyadEventDTO[]>([])
  const [rituals, setRituals] = useState<DyadRitualDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [message, setMessage] = useState('')
  const [ritualTitle, setRitualTitle] = useState('')
  const [mediationInput, setMediationInput] = useState('')
  const [mediation, setMediation] = useState<MediationDTO | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const r = (await aDeuxApi.getWorkspace(pairingToken)) as {
        events?: DyadEventDTO[]
        rituals?: DyadRitualDTO[]
      }
      setEvents(r.events || [])
      setRituals(r.rituals || [])
    } catch {
      setError(t('duoJourney.workspaceError'))
    } finally {
      setLoading(false)
    }
  }, [pairingToken])

  useEffect(() => {
    void reload()
  }, [reload])

  async function sendMessage() {
    if (!message.trim()) return
    setBusy(true)
    setError('')
    try {
      await aDeuxApi.postWorkspace(pairingToken, { action: 'message', content: message.trim() })
      setMessage('')
      await reload()
    } catch (e) {
      setError((e as { message?: string })?.message || t('couple.threadSend'))
    } finally {
      setBusy(false)
    }
  }

  async function addRitual() {
    if (!ritualTitle.trim()) return
    setBusy(true)
    try {
      await aDeuxApi.postWorkspace(pairingToken, { action: 'ritual', title: ritualTitle.trim() })
      setRitualTitle('')
      await reload()
    } finally {
      setBusy(false)
    }
  }

  async function completeRitual(id: number) {
    setBusy(true)
    try {
      await aDeuxApi.postWorkspace(pairingToken, { action: 'completeRitual', ritualId: id })
      await reload()
    } finally {
      setBusy(false)
    }
  }

  async function runMediation() {
    if (!mediationInput.trim()) return
    setBusy(true)
    setMediation(null)
    try {
      const r = await dyadsApi.mediation(mediationInput.trim(), locale)
      setMediation(r.mediation)
    } catch (e) {
      setError((e as { message?: string })?.message || t('couple.mediationError'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500 py-4">{t('common.loading')}</p>
  }

  return (
    <div className="space-y-8 pt-2">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('duoResult.gardenToolsTitle')}</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('duoResult.gardenToolsLead')}</p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-5 dark:border-violet-900 dark:bg-violet-950/20">
        <h4 className="font-semibold text-slate-900 dark:text-slate-100">{t('couple.mediationTitle')}</h4>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('couple.mediationLead')}</p>
        <textarea
          value={mediationInput}
          onChange={(e) => setMediationInput(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder={t('couple.mediationPlaceholder')}
          className="mt-3 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm focus:border-violet-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        <button
          type="button"
          onClick={runMediation}
          disabled={busy || !mediationInput.trim()}
          className="mt-2 rounded-full bg-violet-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {t('couple.mediationCta')}
        </button>
        {mediation ? (
          <div className="mt-4 space-y-3 text-sm">
            <MediationBlock label={t('couple.medReframed')} value={mediation.reframed} />
            <MediationBlock label={t('couple.medOther')} value={mediation.otherPerspective} />
            <MediationBlock label={t('couple.medDeescalation')} value={mediation.deescalation} />
            <MediationBlock label={t('couple.medSuggestion')} value={mediation.suggestion} />
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 dark:border-emerald-900 dark:bg-emerald-950/20">
        <h4 className="font-semibold text-slate-900 dark:text-slate-100">{t('couple.ritualsTitle')}</h4>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={ritualTitle}
            onChange={(e) => setRitualTitle(e.target.value)}
            placeholder={t('couple.ritualPlaceholder')}
            className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={addRitual}
            disabled={busy || !ritualTitle.trim()}
            className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {t('couple.ritualAdd')}
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {rituals.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <span className="text-slate-700 dark:text-slate-200">{r.title}</span>
              <button
                type="button"
                onClick={() => completeRitual(r.id)}
                className="rounded-full border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
              >
                {t('couple.ritualDone')}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h4 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">{t('couple.threadTitle')}</h4>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('couple.threadPlaceholder')}
            className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={busy || !message.trim()}
            className="rounded-full bg-pink-500 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {t('couple.threadSend')}
          </button>
        </div>
        <ul className="mt-4 space-y-2">
          {events
            .filter((e) => e.type === 'message')
            .map((e) => (
              <li
                key={e.id}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                {e.content}
              </li>
            ))}
        </ul>
      </section>
    </div>
  )
}

function MediationBlock({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-violet-600 dark:text-violet-300">{label}</p>
      <p className="text-slate-700 dark:text-slate-200">{value}</p>
    </div>
  )
}
