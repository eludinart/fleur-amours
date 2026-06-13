'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { authApi } from '@/api/auth'
import { FleurSociale } from '@/components/FleurSociale'
import { FLOWER_EMOJIS, JARDIN_INTENTION_IDS } from '@/lib/profile-constants'
import { isValidAge, isValidPseudo, needsProfileOnboarding } from '@/lib/profile-onboarding'
import { t } from '@/i18n'

const STEPS = 7

type FormState = {
  name: string
  pseudo: string
  age: string
  avatar_emoji: string
  bio: string
  jardin_intention: string
  profile_public: boolean
}

function defaultForm(user: Record<string, unknown> | null): FormState {
  return {
    name: String(user?.name ?? '').trim(),
    pseudo: String(user?.pseudo ?? '').trim().toLowerCase(),
    age: user?.age ? String(user.age) : '',
    avatar_emoji: String(user?.avatar_emoji ?? '🌸'),
    bio: String(user?.bio ?? '').trim(),
    jardin_intention: String(user?.jardin_intention ?? 'resonance'),
    profile_public: user?.profile_public !== false,
  }
}

export default function ProfileOnboardingPage() {
  const router = useRouter()
  const { user, refreshUser } = useAuth()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormState>(() => defaultForm(user))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    authApi
      .getMyProfile()
      .then((p) => {
        const prof = p as Record<string, unknown>
        setForm(defaultForm(prof))
        if (!needsProfileOnboarding(prof)) {
          router.replace('/')
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user?.id, router])

  const previewScores = useMemo(
    () => ({
      agape: 0.5,
      philautia: 0.4,
      philia: 0.55,
      eros: 0.35,
      ludus: 0.45,
      pragma: 0.3,
      storge: 0.4,
      mania: 0.25,
    }),
    []
  )

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setError('')
  }

  function validateStep(): string | null {
    if (step === 1) {
      if (!form.name.trim()) return t('profileOnboarding.errorName')
    }
    if (step === 2) {
      const pseudo = form.pseudo.trim().toLowerCase()
      if (!pseudo) return t('profileOnboarding.errorPseudo')
      if (!isValidPseudo(pseudo)) return t('profileOnboarding.errorPseudoFormat')
    }
    if (step === 3) {
      const n = parseInt(form.age, 10)
      if (!form.age.trim()) return t('profileOnboarding.errorAge')
      if (!isValidAge(n)) return t('profileOnboarding.errorAgeRange')
    }
    if (step === 4) {
      if (!form.avatar_emoji) return t('profileOnboarding.errorEmoji')
    }
    return null
  }

  function goNext() {
    const err = validateStep()
    if (err) {
      setError(err)
      return
    }
    setStep((s) => Math.min(STEPS - 1, s + 1))
  }

  function goBack() {
    setError('')
    setStep((s) => Math.max(0, s - 1))
  }

  async function finish(skipped = false) {
    setSaving(true)
    setError('')
    try {
      const payload: Record<string, unknown> = {
        profile_onboarding_done: true,
      }
      if (!skipped) {
        payload.name = form.name.trim()
        payload.pseudo = form.pseudo.trim().toLowerCase()
        payload.age = parseInt(form.age, 10)
        payload.avatar_emoji = form.avatar_emoji
        payload.bio = form.bio.trim()
        payload.jardin_intention = form.jardin_intention
        payload.profile_public = form.profile_public
      }
      await authApi.updateMyProfile(payload)
      await refreshUser()
      try {
        sessionStorage.setItem('fleur_post_register_onboarding', '1')
      } catch {
        /* ignore */
      }
      router.replace('/')
    } catch (e: unknown) {
      const ex = e as { message?: string; detail?: string }
      setError(ex?.detail || ex?.message || t('profileOnboarding.saveError'))
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[100svh] flex items-center justify-center bg-gradient-to-b from-[#050b1a] via-[#0a1630] to-[#070d22]">
        <span className="w-10 h-10 border-2 border-violet-400/40 border-t-violet-300 rounded-full animate-spin" />
      </div>
    )
  }

  const progress = ((step + 1) / STEPS) * 100

  return (
    <div className="min-h-[100svh] flex flex-col bg-gradient-to-b from-[#050b1a] via-[#0a1630] to-[#070d22] text-slate-100">
      <div className="h-1 bg-slate-800/80 shrink-0">
        <div
          className="h-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-400 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <header className="shrink-0 px-4 py-4 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-300/90">
          {t('profileOnboarding.stepLabel', { current: step + 1, total: STEPS })}
        </p>
        <button
          type="button"
          onClick={() => finish(true)}
          disabled={saving}
          className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50"
        >
          {t('profileOnboarding.skipAll')}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <div className="max-w-lg mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28 }}
              className="space-y-5"
            >
              {step === 0 && (
                <>
                  <div className="text-center py-4">
                    <div className="inline-flex justify-center mb-4">
                      <FleurSociale
                        scores={previewScores}
                        avatarEmoji="🌸"
                        pseudo={form.pseudo || t('profileOnboarding.previewPseudo')}
                        size={100}
                        variant="portrait"
                      />
                    </div>
                    <h1 className="text-2xl font-bold text-amber-50">{t('profileOnboarding.welcomeTitle')}</h1>
                    <p className="mt-2 text-sm text-slate-400 leading-relaxed">{t('profileOnboarding.welcomeBody')}</p>
                  </div>
                  <ul className="space-y-2 text-sm text-slate-400">
                    <li className="flex gap-2"><span className="text-emerald-400">✓</span>{t('profileOnboarding.bulletName')}</li>
                    <li className="flex gap-2"><span className="text-emerald-400">✓</span>{t('profileOnboarding.bulletPseudo')}</li>
                    <li className="flex gap-2"><span className="text-emerald-400">✓</span>{t('profileOnboarding.bulletAge')}</li>
                    <li className="flex gap-2"><span className="text-emerald-400">✓</span>{t('profileOnboarding.bulletBio')}</li>
                  </ul>
                </>
              )}

              {step === 1 && (
                <>
                  <h2 className="text-xl font-bold text-amber-50">{t('profileOnboarding.nameTitle')}</h2>
                  <p className="text-sm text-slate-400">{t('profileOnboarding.nameHint')}</p>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => patch('name', e.target.value)}
                    placeholder={t('profileOnboarding.namePlaceholder')}
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl border border-slate-600/60 bg-slate-900/70 text-amber-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  />
                </>
              )}

              {step === 2 && (
                <>
                  <h2 className="text-xl font-bold text-amber-50">{t('profileOnboarding.pseudoTitle')}</h2>
                  <p className="text-sm text-slate-400">{t('profileOnboarding.pseudoHint')}</p>
                  <input
                    type="text"
                    value={form.pseudo}
                    onChange={(e) => patch('pseudo', e.target.value.replace(/\s/g, '').toLowerCase())}
                    placeholder={t('profileOnboarding.pseudoPlaceholder')}
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl border border-slate-600/60 bg-slate-900/70 text-amber-50 font-mono placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  />
                  <p className="text-[11px] text-slate-500">{t('profileOnboarding.pseudoFormat')}</p>
                </>
              )}

              {step === 3 && (
                <>
                  <h2 className="text-xl font-bold text-amber-50">{t('profileOnboarding.ageTitle')}</h2>
                  <p className="text-sm text-slate-400">{t('profileOnboarding.ageHint')}</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={16}
                      max={120}
                      value={form.age}
                      onChange={(e) => patch('age', e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
                      placeholder="32"
                      autoFocus
                      className="w-28 px-4 py-3 rounded-xl border border-slate-600/60 bg-slate-900/70 text-amber-50 text-center text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    />
                    <span className="text-slate-400 text-sm">{t('profileOnboarding.ageUnit')}</span>
                  </div>
                </>
              )}

              {step === 4 && (
                <>
                  <h2 className="text-xl font-bold text-amber-50">{t('profileOnboarding.emojiTitle')}</h2>
                  <p className="text-sm text-slate-400">{t('profileOnboarding.emojiHint')}</p>
                  <div className="flex justify-center py-2">
                    <FleurSociale
                      scores={previewScores}
                      avatarEmoji={form.avatar_emoji}
                      pseudo={form.pseudo || form.name || '…'}
                      size={88}
                      variant="portrait"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {FLOWER_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => patch('avatar_emoji', emoji)}
                        className={`w-11 h-11 rounded-xl text-xl transition-all hover:scale-110 ${
                          form.avatar_emoji === emoji
                            ? 'bg-violet-600 ring-2 ring-violet-400 scale-110'
                            : 'bg-slate-800/80 hover:bg-slate-700/80'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 5 && (
                <>
                  <h2 className="text-xl font-bold text-amber-50">{t('profileOnboarding.bioTitle')}</h2>
                  <p className="text-sm text-slate-400">{t('profileOnboarding.bioHint')}</p>
                  <textarea
                    value={form.bio}
                    onChange={(e) => patch('bio', e.target.value.slice(0, 500))}
                    rows={5}
                    placeholder={t('profileOnboarding.bioPlaceholder')}
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl border border-slate-600/60 bg-slate-900/70 text-amber-50 placeholder:text-slate-500 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  />
                  <p className="text-[11px] text-slate-500 text-right">{form.bio.length}/500</p>
                </>
              )}

              {step === 6 && (
                <>
                  <h2 className="text-xl font-bold text-amber-50">{t('profileOnboarding.intentionTitle')}</h2>
                  <p className="text-sm text-slate-400">{t('profileOnboarding.intentionHint')}</p>
                  <div className="space-y-2">
                    {JARDIN_INTENTION_IDS.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => patch('jardin_intention', id)}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                          form.jardin_intention === id
                            ? 'border-violet-500/70 bg-violet-950/40 text-violet-100'
                            : 'border-slate-600/50 bg-slate-900/40 text-slate-300 hover:border-slate-500/70'
                        }`}
                      >
                        {t(`profileOnboarding.intention.${id}`)}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-start gap-3 mt-4 p-4 rounded-xl border border-emerald-700/35 bg-emerald-950/20 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.profile_public}
                      onChange={(e) => patch('profile_public', e.target.checked)}
                      className="mt-1 rounded border-slate-500"
                    />
                    <span>
                      <span className="block text-sm font-medium text-emerald-100">{t('profileOnboarding.publicTitle')}</span>
                      <span className="block text-[11px] text-emerald-300/70 mt-0.5">{t('profileOnboarding.publicHint')}</span>
                    </span>
                  </label>
                </>
              )}

              {error && (
                <p className="rounded-xl border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
                  {error}
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <footer className="shrink-0 px-4 py-4 border-t border-slate-700/50 bg-slate-950/60 backdrop-blur-sm">
        <div className="max-w-lg mx-auto flex gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={goBack}
              disabled={saving}
              className="px-5 py-3 rounded-full border border-slate-600/60 text-sm font-medium text-slate-400 hover:bg-slate-800/60 disabled:opacity-50"
            >
              {t('onboarding.back')}
            </button>
          )}
          {step < STEPS - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="flex-1 py-3 rounded-full bg-violet-600 hover:bg-violet-500 font-semibold text-white transition-colors"
            >
              {t('onboarding.next')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => finish(false)}
              disabled={saving}
              className="flex-1 py-3 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 font-semibold text-white transition-all disabled:opacity-60"
            >
              {saving ? t('profileOnboarding.saving') : t('profileOnboarding.finish')}
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
