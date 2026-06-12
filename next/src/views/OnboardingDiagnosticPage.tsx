'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FlowerSVG, PetalSlider, PETAL_DEFS } from '@/components/FlowerSVG'
import { onboardingApi } from '@/api/onboarding'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

function defaultPetals(): Record<string, number> {
  const o: Record<string, number> = {}
  for (const p of PETAL_DEFS) o[p.id] = 0.4
  return o
}

export default function OnboardingDiagnosticPage() {
  useStore((s) => s.locale)
  const router = useRouter()
  const [petals, setPetals] = useState<Record<string, number>>(defaultPetals())
  const [intention, setIntention] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [alreadySet, setAlreadySet] = useState(false)

  useEffect(() => {
    let cancelled = false
    onboardingApi
      .getBaseline()
      .then((r) => {
        if (cancelled) return
        if (r.baseline) {
          setPetals({ ...defaultPetals(), ...r.baseline.petals })
          setIntention(r.baseline.intention ?? '')
          setAlreadySet(true)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function setPetal(id: string, value: number) {
    setPetals((prev) => ({ ...prev, [id]: value }))
  }

  async function submit() {
    setSaving(true)
    setError('')
    try {
      await onboardingApi.saveBaseline({ petals, intention: intention.trim() || undefined })
      router.push('/eclosion')
    } catch (e) {
      const err = e as { message?: string; detail?: string }
      setError(err?.detail || err?.message || t('onboardingDiag.saveError'))
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" aria-hidden />
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('onboardingDiag.title')}</h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {alreadySet ? t('onboardingDiag.alreadySet') : t('onboardingDiag.subtitle')}
          </p>
        </header>

        <div className="mb-6 flex justify-center">
          <FlowerSVG petals={petals} size={220} animate showLabels />
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {PETAL_DEFS.map((p) => (
            <PetalSlider
              key={p.id}
              petalId={p.id}
              label={p.name}
              color={p.color}
              value={petals[p.id] ?? 0}
              onChange={setPetal}
            />
          ))}
        </div>

        <div className="mt-5">
          <label className="mb-2 block font-medium text-slate-800 dark:text-slate-100">{t('onboardingDiag.intentionLabel')}</label>
          <textarea
            value={intention}
            onChange={(e) => setIntention(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder={t('onboardingDiag.intentionPlaceholder')}
            className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-800 focus:border-violet-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={saving || alreadySet}
            className="flex-1 rounded-full bg-violet-600 py-3 font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
          >
            {alreadySet ? t('onboardingDiag.locked') : saving ? t('onboardingDiag.saving') : t('onboardingDiag.submit')}
          </button>
          <button
            type="button"
            onClick={() => router.push('/eclosion')}
            className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {t('onboardingDiag.skip')}
          </button>
        </div>
      </div>
    </div>
  )
}
