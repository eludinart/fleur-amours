// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { authApi } from '@/api/auth'
import { socialApi } from '@/api/social'
import { prairieApi } from '@/api/prairie'
import { t } from '@/i18n'

/**
 * Modale d'onboarding communautaire en 3 étapes (A5) :
 *  1. Visibilité (devenir visible dans le Grand Jardin),
 *  2. Suggestions (aperçu de 3 fleurs résonantes),
 *  3. Première rosée (encourager le premier geste — gratuit).
 *
 * Déclenchée automatiquement la première fois qu'un utilisateur ouvre
 * une vue communautaire sans avoir validé l'onboarding (`fleur_community_onboarding_done`).
 */
export function CommunityOnboardingModal({ onClose }: { onClose: () => void }) {
  const { user, refreshUser } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [savingVisibility, setSavingVisibility] = useState(false)
  const [profilePublic, setProfilePublic] = useState<boolean>(Boolean((user as Record<string, unknown>)?.profile_public))
  const [suggestions, setSuggestions] = useState<Array<{ user_id: number; pseudo: string; avatar_emoji?: string; resonance_pct?: number }>>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [finishing, setFinishing] = useState(false)

  // Charger 3 suggestions à l'étape 2
  useEffect(() => {
    if (step !== 2) return
    let cancelled = false
    setLoadingSuggestions(true)
    prairieApi
      .getFleurs()
      .then((res: { fleurs?: Array<Record<string, unknown>> } | undefined) => {
        if (cancelled) return
        const list = (res?.fleurs ?? [])
          .filter((it) => it && it.user_id && Number(it.user_id) !== Number(user?.id))
          .slice(0, 3)
          .map((it) => ({
            user_id: Number(it.user_id),
            pseudo: String(it.pseudo ?? it.name ?? '—'),
            avatar_emoji: String(it.avatar_emoji ?? '🌸'),
            resonance_pct: typeof it.resonance_pct === 'number' ? it.resonance_pct : undefined,
          }))
        setSuggestions(list)
      })
      .catch(() => {
        if (!cancelled) setSuggestions([])
      })
      .finally(() => {
        if (!cancelled) setLoadingSuggestions(false)
      })
    return () => {
      cancelled = true
    }
  }, [step, user?.id])

  const handleToggleVisibility = async (next: boolean) => {
    setSavingVisibility(true)
    try {
      await authApi.updateMyProfile({ profile_public: next })
      setProfilePublic(next)
      await refreshUser()
    } finally {
      setSavingVisibility(false)
    }
  }

  const finishOnboarding = async (action?: 'arroser' | 'prairie') => {
    setFinishing(true)
    try {
      await socialApi.markCommunityOnboardingDone()
      await refreshUser()
    } finally {
      setFinishing(false)
      onClose()
      if (action === 'prairie') router.push('/prairie')
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
      >
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-full max-w-md rounded-3xl border border-emerald-300/30 dark:border-emerald-800/60 shadow-2xl overflow-hidden bg-white dark:bg-[#0b1320]"
        >
          {/* Header */}
          <div className="p-5 pb-3 bg-gradient-to-b from-emerald-50 to-teal-50 dark:from-emerald-950/70 dark:to-slate-900">
            <p className="text-[10px] uppercase tracking-widest text-emerald-700/80 dark:text-emerald-300/80 mb-1">
              {t('communityOnboarding.title')} · {step}/3
            </p>
            <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
              {step === 1 && t('communityOnboarding.step1Title')}
              {step === 2 && t('communityOnboarding.step2Title')}
              {step === 3 && t('communityOnboarding.step3Title')}
            </h3>
            <p className="text-xs text-emerald-700/80 dark:text-emerald-300/70 mt-1">
              {t('communityOnboarding.subtitle')}
            </p>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            {step === 1 && (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {t('communityOnboarding.step1Desc')}
                </p>
                <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-emerald-200/70 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/30">
                  <span className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                    {profilePublic ? t('communityOnboarding.step1Done') : t('communityOnboarding.step1Cta')}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={profilePublic}
                    onClick={() => handleToggleVisibility(!profilePublic)}
                    disabled={savingVisibility}
                    className={`relative h-6 w-11 rounded-full transition-colors ${profilePublic ? 'bg-emerald-500' : 'bg-slate-400/60'} disabled:opacity-60`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${profilePublic ? 'left-5' : 'left-0.5'}`}
                    />
                  </button>
                </label>
              </>
            )}

            {step === 2 && (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {t('communityOnboarding.step2Desc')}
                </p>
                {loadingSuggestions ? (
                  <p className="text-xs text-slate-400">{t('common.loading')}…</p>
                ) : suggestions.length === 0 ? (
                  <p className="text-xs text-slate-500">{t('communityOnboarding.step2Empty')}</p>
                ) : (
                  <ul className="space-y-2">
                    {suggestions.map((s) => (
                      <li key={s.user_id}>
                        <button
                          type="button"
                          onClick={() => router.push(`/lisiere/${s.user_id}`)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-400 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-colors text-left"
                        >
                          <span className="text-2xl">{s.avatar_emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{s.pseudo}</p>
                            {typeof s.resonance_pct === 'number' && (
                              <p className="text-[11px] text-emerald-600 dark:text-emerald-300">
                                {Math.round(s.resonance_pct)}%
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-slate-400">{t('communityOnboarding.step2VisitLisiere')} →</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {step === 3 && (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {t('communityOnboarding.step3Desc')}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => finishOnboarding()}
              disabled={finishing}
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-50"
            >
              {t('communityOnboarding.skip')}
            </button>
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(3, s + 1))}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
              >
                →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => finishOnboarding('prairie')}
                disabled={finishing}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {finishing ? '…' : t('communityOnboarding.step3GoExplore')}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
