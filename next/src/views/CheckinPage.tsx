'use client'

import { useEffect, useState } from 'react'
import { checkinsApi, type CheckinDTO } from '@/api/checkins'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

const SCALE = [1, 2, 3, 4, 5]

function formatDate(s: string, locale: string) {
  if (!s) return '—'
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString(locale || 'fr', { day: 'numeric', month: 'short' })
}

export default function CheckinPage() {
  const locale = useStore((s) => s.locale) || 'fr'
  const [mood, setMood] = useState(3)
  const [tension, setTension] = useState(3)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<CheckinDTO[]>([])

  function loadHistory() {
    checkinsApi
      .my()
      .then((r) => setHistory(r.checkins || []))
      .catch(() => setHistory([]))
  }

  useEffect(() => {
    loadHistory()
  }, [])

  async function submit() {
    setSaving(true)
    setError('')
    try {
      await checkinsApi.save({ mood, tension, note: note.trim() || undefined })
      setDone(true)
      setNote('')
      loadHistory()
      setTimeout(() => setDone(false), 2500)
    } catch (e) {
      const err = e as { message?: string; detail?: string }
      setError(err?.detail || err?.message || t('checkin.saveError'))
    } finally {
      setSaving(false)
    }
  }

  function ScaleRow({
    label,
    value,
    onChange,
    lowLabel,
    highLabel,
  }: {
    label: string
    value: number
    onChange: (v: number) => void
    lowLabel: string
    highLabel: string
  }) {
    return (
      <div>
        <label className="mb-2 block font-medium text-slate-800 dark:text-slate-100">{label}</label>
        <div className="flex gap-2">
          {SCALE.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-pressed={value === n}
              className={`h-11 flex-1 rounded-xl border text-sm font-semibold transition ${
                value === n
                  ? 'border-violet-500 bg-violet-600 text-white shadow'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-violet-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-slate-400">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('checkin.title')}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('checkin.subtitle')}</p>
        </header>

        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <ScaleRow
            label={t('checkin.moodLabel')}
            value={mood}
            onChange={setMood}
            lowLabel={t('checkin.moodLow')}
            highLabel={t('checkin.moodHigh')}
          />
          <ScaleRow
            label={t('checkin.tensionLabel')}
            value={tension}
            onChange={setTension}
            lowLabel={t('checkin.tensionLow')}
            highLabel={t('checkin.tensionHigh')}
          />
          <div>
            <label className="mb-2 block font-medium text-slate-800 dark:text-slate-100">{t('checkin.noteLabel')}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={t('checkin.notePlaceholder')}
              className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-800 focus:border-violet-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="w-full rounded-full bg-violet-600 py-3 font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
          >
            {done ? t('checkin.saved') : saving ? t('checkin.saving') : t('checkin.submit')}
          </button>
        </div>

        {history.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">{t('checkin.historyTitle')}</h2>
            <ul className="space-y-2">
              {history.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <span className="text-slate-500 dark:text-slate-400">{formatDate(c.createdAt, locale)}</span>
                  <span className="flex gap-4 text-slate-700 dark:text-slate-200">
                    <span>{t('checkin.moodShort')} {c.mood}/5</span>
                    <span>{t('checkin.tensionShort')} {c.tension}/5</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
