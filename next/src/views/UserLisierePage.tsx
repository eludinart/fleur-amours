// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { useSocialStore } from '@/store/useSocialStore'
import { RosaceResonance } from '@/components/social/RosaceResonance'
import { SeedModal } from '@/components/social/SeedModal'
import { t } from '@/i18n'

export default function UserLisierePage() {
  const pathname = usePathname()
  const pathSegments = (pathname || '').replace(/^\/+/, '').split('/').filter(Boolean)
  const userId = pathSegments[0] === 'lisiere' && pathSegments[1] ? pathSegments[1] : null
  const router = useRouter()
  const { user } = useAuth()
  const {
    lisiere,
    lisiereLoading,
    lisiereError,
    loadLisiere,
    sendSeed,
    clearLisiere,
    acceptConnection,
  } = useSocialStore()
  const [showSeedModal, setShowSeedModal] = useState(false)
  const [seedError, setSeedError] = useState(null)
  const [accepting, setAccepting] = useState(false)

  const meId = user?.id ? String(user.id) : null
  const isMe = meId && userId && String(userId) === meId

  useEffect(() => {
    if (!userId || isMe) {
      if (isMe) router.replace('/prairie')
      return
    }
    loadLisiere(userId).catch(() => {})
    return () => clearLisiere()
  }, [userId, isMe, loadLisiere, clearLisiere, router])

  const handleSeedSent = async (targetUserId, intentionId) => {
    setSeedError(null)
    await sendSeed(targetUserId, intentionId)
  }

  const handleAcceptSeed = async (seedId) => {
    setAccepting(true)
    try {
      const result = await acceptConnection(seedId)
      if (result?.channelId) router.replace(`/clairiere/${result.channelId}`)
    } finally {
      setAccepting(false)
    }
  }

  if (isMe || !userId) return null
  if (lisiereLoading) {
    return (
      <div className="flex-1 min-h-[60vh] flex items-center justify-center bg-gradient-to-b from-emerald-50 to-teal-100 dark:from-emerald-950/40 dark:to-slate-900">
        <span className="w-10 h-10 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    )
  }
  if (lisiereError || !lisiere) {
    return (
      <div className="flex-1 min-h-[60vh] flex flex-col items-center justify-center p-6 bg-gradient-to-b from-emerald-50 to-teal-100 dark:from-emerald-950/40 dark:to-slate-900">
        <p className="text-slate-600 dark:text-slate-400 mb-4">
          {lisiereError || (t('social.profilNonTrouve') ?? 'Profil non trouvé ou non public.')}
        </p>
        <button
          type="button"
          onClick={() => router.push('/prairie')}
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium"
        >
          {t('prairie.viewPrairie')} ←
        </button>
      </div>
    )
  }

  const status = lisiere.relationStatusWithVisitor || 'none'
  const petals = lisiere.fleurMoyenne?.petals ?? []
  const seedId = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('seed')

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-gradient-to-b from-emerald-50/90 via-teal-50/70 to-lime-50/80 dark:from-emerald-950/50 dark:via-slate-900 dark:to-slate-900">
      <header className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-emerald-200/60 dark:border-slate-700">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-white/50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
          aria-label={t('common.back')}
        >
          ←
        </button>
        <h1 className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
          {t('social.lisiere') ?? 'La Lisière'}
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <motion.div
          className="max-w-md mx-auto"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <div className="flex flex-col items-center mb-6">
            <div className="text-4xl mb-2">{lisiere.avatarEmoji || '🌸'}</div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{lisiere.pseudo}</h2>
          </div>

          <div className="flex justify-center mb-6">
            <RosaceResonance petals={petals} size={140} />
          </div>

          {lisiere.echoInflorescence && (
            <div className="rounded-2xl border border-emerald-200/60 dark:border-slate-600 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm p-4 mb-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2">
                {t('social.echoInflorescence') ?? 'Écho de l’Inflorescence'}
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic">
                {lisiere.echoInflorescence}
              </p>
            </div>
          )}
          {lisiere.social && (
            <div className="rounded-2xl border border-cyan-200/60 dark:border-cyan-800/60 bg-cyan-50/60 dark:bg-cyan-950/20 p-3 mb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-300 mb-1">
                Activite sociale
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                💧 Gouttes recues: {lisiere.social.rosee_received_total ?? 0} (aujourd'hui: {lisiere.social.rosee_received_today ?? 0})
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                🌸 Pollens recus: {lisiere.social.pollen_received_total ?? 0} (aujourd'hui: {lisiere.social.pollen_received_today ?? 0})
              </p>
            </div>
          )}

          {seedError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-sm">
              {seedError}
            </div>
          )}

          <div className="space-y-3">
            {status === 'pending_in' && seedId && (
              <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 p-4">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-3">
                  {t('social.graineTAttend') ?? 'Une Graine t’attend ici.'}
                </p>
                <button
                  type="button"
                  onClick={() => handleAcceptSeed(seedId)}
                  disabled={accepting}
                  className="w-full py-2.5 rounded-xl bg-amber-500 text-amber-950 font-medium text-sm hover:bg-amber-600 disabled:opacity-50"
                >
                  {accepting ? '…' : (t('social.accueillir') ?? 'Accueillir')}
                </button>
              </div>
            )}
            {status === 'accepted' && (
              <button
                type="button"
                onClick={() => router.push(`/clairiere?with=${lisiere.userId}`)}
                className="w-full py-3 rounded-2xl bg-violet-500/20 text-violet-700 dark:text-violet-300 font-medium text-sm border border-violet-300/50 dark:border-violet-600/50 hover:bg-violet-500/30 transition-all duration-300"
              >
                🌿 {t('social.ouvrirClairiere') ?? 'Ouvrir la Clairière'}
              </button>
            )}
            {status === 'none' && (
              <button
                type="button"
                onClick={() => setShowSeedModal(true)}
                className="w-full py-3 rounded-2xl bg-emerald-500 text-white font-medium text-sm hover:bg-emerald-600 shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:scale-[1.02]"
              >
                🌱 {t('social.deposerGraine') ?? 'Déposer une Graine'}
              </button>
            )}
            {status === 'pending_out' && (
              <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-2">
                {t('social.graineDejaDeposee') ?? 'Graine déjà déposée. En attente d’accueil.'}
              </p>
            )}
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showSeedModal && (
          <SeedModal
            targetUserId={userId}
            targetPseudo={lisiere.pseudo}
            onClose={() => { setShowSeedModal(false); setSeedError(null) }}
            onSent={handleSeedSent}
            onError={setSeedError}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
