'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FlowerSVG, scoresToPetals } from '@/components/FlowerSVG'
import { MyceliumWellbeingInterview } from '@/components/mycelium/MyceliumWellbeingInterview'
import { myceliumApi, type WorkCheckinDTO } from '@/api/mycelium'
import { PETAL_IDS_ORDER, petalLabel } from '@/lib/mycelium-lexicon'
import { PETAL_BY_ID } from '@/lib/petal-theme'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

const SCALE = [1, 2, 3, 4, 5]

const DEFAULT_PETALS: Record<string, number> = Object.fromEntries(PETAL_IDS_ORDER.map((id) => [id, 0.5]))

function formatDate(s: string, locale: string) {
  if (!s) return '—'
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString(locale || 'fr', { day: 'numeric', month: 'short' })
}

export default function MyceliumEspacePage() {
  const locale = useStore((s) => s.locale) || 'fr'
  const [loading, setLoading] = useState(true)
  const [orgName, setOrgName] = useState('')
  const [charter, setCharter] = useState<string | null>(null)
  const [teamName, setTeamName] = useState<string | null>(null)
  const [pulseCampaign, setPulseCampaign] = useState<{ title: string; message: string; question: string } | null>(null)
  const [hasOrg, setHasOrg] = useState(false)
  const [streak, setStreak] = useState(0)
  const [profilePetals, setProfilePetals] = useState<Record<string, number>>(DEFAULT_PETALS)
  const [hasProfile, setHasProfile] = useState(false)
  const [showProfileForm, setShowProfileForm] = useState(false)
  const [mood, setMood] = useState(3)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [pulseDone, setPulseDone] = useState(false)
  const [profileDone, setProfileDone] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<WorkCheckinDTO[]>([])

  function reload() {
    setLoading(true)
    setError('')
    myceliumApi
      .membership()
      .then((r) => {
        if (!r.membership || !r.org) {
          setHasOrg(false)
          return
        }
        setHasOrg(true)
        setOrgName(r.org.name)
        setCharter(r.org.charter ?? null)
        setPulseCampaign(
          r.org.pulseCampaign?.active
            ? {
                title: r.org.pulseCampaign.title,
                message: r.org.pulseCampaign.message,
                question: r.org.pulseCampaign.question,
              }
            : null
        )
        setTeamName(r.team?.name ?? null)
        setStreak(r.streak ?? 0)
        setHistory(r.recentCheckins || [])
        if (r.profile?.petals) {
          setProfilePetals(r.profile.petals)
          setHasProfile(true)
        } else {
          setShowProfileForm(true)
        }
      })
      .catch((e) => {
        setHasOrg(false)
        setError((e as { message?: string })?.message || t('mycelium.error'))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
  }, [])

  async function submitPulse() {
    setSaving(true)
    setError('')
    try {
      await myceliumApi.saveCheckin({ mood, note: note.trim() || undefined })
      setPulseDone(true)
      setNote('')
      reload()
      setTimeout(() => setPulseDone(false), 2500)
    } catch (e) {
      setError((e as { message?: string })?.message || t('mycelium.error'))
    } finally {
      setSaving(false)
    }
  }

  async function submitProfile() {
    setSaving(true)
    setError('')
    try {
      await myceliumApi.saveProfile(profilePetals)
      setHasProfile(true)
      setShowProfileForm(false)
      setProfileDone(true)
      reload()
      setTimeout(() => setProfileDone(false), 2500)
    } catch (e) {
      setError((e as { message?: string })?.message || t('mycelium.error'))
    } finally {
      setSaving(false)
    }
  }

  const flowerPetals = scoresToPetals(profilePetals)

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              {t('mycelium.espaceBadge')}
            </p>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('mycelium.espaceTitle')}</h1>
            {orgName && <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-300">{orgName}</p>}
            {teamName && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('mycelium.teamLabel')} {teamName}
              </p>
            )}
          </div>
          <Link
            href="/mycelium/dashboard"
            className="rounded-full border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
          >
            {t('mycelium.dashboardLink')}
          </Link>
        </header>

        {loading ? (
          <div className="flex justify-center py-12">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" aria-hidden />
          </div>
        ) : !hasOrg ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-300">{t('mycelium.espaceNoOrg')}</p>
            <Link
              href="/mycelium/admin"
              className="mt-4 inline-block rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              {t('mycelium.createOrgCta')}
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {pulseCampaign && (
              <section className="rounded-2xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm dark:border-emerald-700 dark:from-emerald-950/40 dark:to-slate-900">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                  {t('mycelium.campaignActive')}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{pulseCampaign.title}</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{pulseCampaign.message}</p>
              </section>
            )}

            {charter && (
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 dark:border-emerald-900 dark:bg-emerald-950/20">
                <p className="text-sm leading-relaxed text-emerald-900 dark:text-emerald-100">{charter}</p>
              </section>
            )}

            <MyceliumWellbeingInterview onPulseSaved={reload} />

            {streak > 0 && (
              <p className="text-center text-sm font-medium text-emerald-700 dark:text-emerald-300">
                🌱 {t('mycelium.streakLabel', { count: String(streak) })}
              </p>
            )}

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </p>
            )}

            {/* Profil au travail */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t('mycelium.workProfileTitle')}</h2>
                {hasProfile && !showProfileForm && (
                  <button
                    type="button"
                    onClick={() => setShowProfileForm(true)}
                    className="text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    {t('mycelium.editProfile')}
                  </button>
                )}
              </div>

              {showProfileForm || !hasProfile ? (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600 dark:text-slate-300">{t('mycelium.workProfileLead')}</p>
                  {PETAL_IDS_ORDER.map((id) => (
                    <div key={id}>
                      <label className="mb-1 flex justify-between text-sm font-medium text-slate-800 dark:text-slate-100">
                        <span>{petalLabel(id, 'A')}</span>
                        <span className="text-xs text-slate-500">{Math.round((profilePetals[id] ?? 0.5) * 100)}%</span>
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round((profilePetals[id] ?? 0.5) * 100)}
                        onChange={(e) =>
                          setProfilePetals((p) => ({ ...p, [id]: parseInt(e.target.value, 10) / 100 }))
                        }
                        className="w-full accent-emerald-600"
                        style={{ accentColor: PETAL_BY_ID[id]?.color }}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={submitProfile}
                    disabled={saving}
                    className="w-full rounded-full bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {saving ? '…' : t('mycelium.saveProfile')}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <FlowerSVG petals={flowerPetals} size={200} animate showLabels />
                  {profileDone && (
                    <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">{t('mycelium.profileSaved')}</p>
                  )}
                </div>
              )}
            </section>

            {/* Pulse rapide (sans entretien IA) */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="mb-1 font-semibold text-slate-900 dark:text-slate-100">{t('mycelium.pulseTitle')}</h2>
              <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">{t('mycelium.pulseQuickHint')}</p>
              <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">{t('mycelium.pulseLead')}</p>

              <label className="mb-2 block font-medium text-slate-800 dark:text-slate-100">{t('mycelium.pulseMood')}</label>
              <div className="mb-4 flex gap-2">
                {SCALE.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setMood(n)}
                    aria-pressed={mood === n}
                    className={`h-11 flex-1 rounded-xl border text-sm font-semibold transition ${
                      mood === n
                        ? 'border-emerald-500 bg-emerald-600 text-white shadow'
                        : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <label className="mb-2 block font-medium text-slate-800 dark:text-slate-100">
                {pulseCampaign?.question ?? t('mycelium.pulseNote')}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder={pulseCampaign?.question ?? t('mycelium.pulseNotePlaceholder')}
                className="mb-4 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm focus:border-emerald-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />

              <button
                type="button"
                onClick={submitPulse}
                disabled={saving}
                className="w-full rounded-full bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? '…' : pulseDone ? t('mycelium.pulseDone') : t('mycelium.pulseCta')}
              </button>
            </section>

            {history.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold text-slate-500 dark:text-slate-400">{t('mycelium.pulseHistory')}</h2>
                <ul className="space-y-2">
                  {history.map((c) => (
                    <li
                      key={c.id}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                    >
                      <div className="flex justify-between text-slate-500 dark:text-slate-400">
                        <span>{formatDate(c.createdAt, locale)}</span>
                        <span>{t('mycelium.moodShort')} {c.mood}/5</span>
                      </div>
                      {c.note && <p className="mt-1 text-slate-700 dark:text-slate-300">{c.note}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
