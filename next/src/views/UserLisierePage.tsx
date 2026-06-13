// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { useSocialStore } from '@/store/useSocialStore'
import { FleurSociale } from '@/components/FleurSociale'
import { SeedModal } from '@/components/social/SeedModal'
import { PETAL_BY_ID } from '@/lib/petal-theme'
import { t } from '@/i18n'

function formatActivityAgo(iso) {
  if (!iso) return null
  const ts = new Date(iso).getTime()
  if (!Number.isFinite(ts)) return null
  const days = Math.floor((Date.now() - ts) / 86400000)
  if (days <= 0) return t('social.lisiereActivityToday')
  if (days === 1) return t('social.lisiereActivityYesterday')
  if (days < 7) return t('social.lisiereActivityDays', { count: days })
  return new Date(ts).toLocaleDateString()
}

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
    await loadLisiere(targetUserId)
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
      <div className="flex-1 min-h-[60vh] flex items-center justify-center bg-gradient-to-b from-[#050b1a] via-[#0a1630] to-[#070d22]">
        <span className="w-10 h-10 border-2 border-emerald-400/40 border-t-emerald-300 rounded-full animate-spin" />
      </div>
    )
  }
  if (lisiereError || !lisiere) {
    return (
      <div className="flex-1 min-h-[60vh] flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#050b1a] via-[#0a1630] to-[#070d22]">
        <p className="text-slate-400 mb-4 text-center max-w-sm">
          {lisiereError || t('social.profilNonTrouve')}
        </p>
        <button
          type="button"
          onClick={() => router.push('/prairie')}
          className="px-4 py-2 rounded-xl bg-emerald-600/80 text-white text-sm font-medium"
        >
          {t('prairie.viewPrairie')} ←
        </button>
      </div>
    )
  }

  const status = lisiere.relationStatusWithVisitor || 'none'
  const seedId = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('seed')
  const dominantDef = lisiere.dominantPetal ? PETAL_BY_ID[lisiere.dominantPetal] : null
  const resonancePct = Math.round((lisiere.resonanceWithVisitor ?? 0) * 100)
  const activityLabel = formatActivityAgo(lisiere.lastActivityAt || lisiere.fleurMoyenne?.lastUpdated)
  const isOnline = !!lisiere.presence?.is_online

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-gradient-to-b from-[#050b1a] via-[#0a1630] to-[#070d22] text-slate-100">
      <header className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-slate-700/60 bg-slate-950/50 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-slate-800 text-slate-400"
          aria-label={t('common.back')}
        >
          ←
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-amber-100 truncate">{lisiere.pseudo}</h1>
          <p className="text-[10px] text-slate-500">{t('social.lisiere')}</p>
        </div>
        <button
          type="button"
          onClick={() => router.push(`/prairie?profile=${lisiere.userId}`)}
          className="text-[10px] px-2 py-1 rounded-lg border border-slate-600/50 text-cyan-300/90 hover:bg-slate-800/60"
        >
          🌌 {t('social.lisiereViewGalaxy')}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <motion.div
          className="max-w-lg mx-auto space-y-4"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          {/* Portrait */}
          <section className="rounded-2xl border border-slate-600/45 bg-slate-950/70 backdrop-blur-md p-4">
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                <FleurSociale
                  scores={lisiere.scores ?? {}}
                  lastActivityAt={lisiere.lastActivityAt}
                  avatarEmoji={lisiere.avatarEmoji}
                  pseudo={lisiere.pseudo}
                  isOnline={isOnline}
                  size={72}
                />
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <p className="text-lg font-bold text-amber-50 truncate">
                  {lisiere.pseudo} {lisiere.avatarEmoji}
                </p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {isOnline ? (
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                      ● {t('social.lisiereOnline')}
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[9px] text-slate-500 border border-slate-600/40">
                      {t('social.lisiereOffline')}
                    </span>
                  )}
                  {dominantDef && (
                    <span
                      className="px-1.5 py-0.5 rounded text-[9px] border"
                      style={{ color: dominantDef.color, borderColor: `${dominantDef.color}44`, backgroundColor: `${dominantDef.color}14` }}
                    >
                      {lisiere.dominantPetalName || dominantDef.name}
                    </span>
                  )}
                  {lisiere.hasDuoLink && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-violet-500/15 text-violet-300 border border-violet-500/25">
                      {t('social.lisiereDuoLink')}
                    </span>
                  )}
                </div>
                {activityLabel && (
                  <p className="text-[10px] text-slate-500 mt-2">
                    {t('social.lisiereLastActivity')}: {activityLabel}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Résumé public */}
          <section className="rounded-2xl border border-emerald-700/35 bg-emerald-950/25 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/90 mb-2">
              {t('social.lisierePortrait')}
            </p>
            <p className="text-sm text-slate-300 leading-relaxed">
              {lisiere.echoInflorescence}
            </p>
          </section>

          {/* Pétales + résonance */}
          <section className="rounded-2xl border border-slate-600/40 bg-slate-900/50 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
              {t('social.lisiereFlower')}
            </p>
            <div className="flex justify-center mb-4 py-2">
              <FleurSociale
                scores={lisiere.scores ?? {}}
                lastActivityAt={lisiere.lastActivityAt}
                avatarEmoji={lisiere.avatarEmoji}
                pseudo={lisiere.pseudo}
                isOnline={isOnline}
                size={128}
              />
            </div>
            {(lisiere.topPetals ?? []).length > 0 ? (
              <div className="space-y-2 mb-3">
                {lisiere.topPetals.map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 w-16 truncate">{p.name}</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round(p.value * 33))}%`, backgroundColor: p.color }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 mb-3">{t('social.lisiereNoScores')}</p>
            )}
            <p className="text-xs text-slate-400">
              {t('social.lisiereResonance')}:{' '}
              <span className="text-cyan-300 font-medium">{resonancePct}%</span>
            </p>
          </section>

          {/* Présence sociale (agrégats, pas d'intimité) */}
          {lisiere.social && (
            <section className="rounded-2xl border border-cyan-800/35 bg-cyan-950/15 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400/80 mb-1">
                {t('social.lisiereGardenLife')}
              </p>
              <p className="text-xs text-slate-400">
                💧 {lisiere.social.rosee_received_total ?? 0} · 🌸 {lisiere.social.pollen_received_total ?? 0}
              </p>
            </section>
          )}

          {seedError && (
            <div className="p-3 rounded-xl bg-rose-900/30 text-rose-300 text-sm border border-rose-800/40">
              {seedError}
            </div>
          )}

          {/* Rencontre */}
          <section className="rounded-2xl border border-amber-600/30 bg-amber-950/15 p-4 space-y-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300/90 mb-1">
              {t('social.lisiereMeet')}
            </p>

            {status === 'pending_in' && seedId && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-3 mb-2">
                <p className="text-sm text-amber-100 mb-3">{t('social.graineTAttend')}</p>
                <button
                  type="button"
                  onClick={() => handleAcceptSeed(seedId)}
                  disabled={accepting}
                  className="w-full py-2.5 rounded-xl bg-amber-500 text-amber-950 font-medium text-sm hover:bg-amber-400 disabled:opacity-50"
                >
                  {accepting ? '…' : t('social.accueillir')}
                </button>
              </div>
            )}

            {status === 'accepted' && (
              <button
                type="button"
                onClick={() => router.push(`/clairiere?with=${lisiere.userId}`)}
                className="w-full py-3 rounded-xl bg-violet-500/20 text-violet-200 font-medium text-sm border border-violet-400/35 hover:bg-violet-500/30"
              >
                💬 {t('social.ouvrirClairiere')}
              </button>
            )}

            {status === 'none' && (
              <button
                type="button"
                onClick={() => setShowSeedModal(true)}
                className="w-full py-3 rounded-xl bg-emerald-500 text-white font-medium text-sm hover:bg-emerald-400 shadow-lg shadow-emerald-900/30"
              >
                🌱 {t('social.deposerGraine')}
              </button>
            )}

            {status === 'pending_out' && (
              <div className="rounded-xl border border-slate-600/40 bg-slate-900/40 p-3 text-center">
                <p className="text-sm text-slate-300 mb-1">{t('social.graineDejaDeposee')}</p>
                <p className="text-[10px] text-slate-500">{t('social.lisierePendingHint')}</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => router.push(`/jardin/duo?invite_user_id=${lisiere.userId}&invite_pseudo=${encodeURIComponent(lisiere.pseudo || '')}`)}
                className="flex-1 py-2 rounded-lg bg-slate-800/80 text-violet-200 text-[11px] border border-slate-600/40 hover:bg-slate-800"
              >
                💕 {t('prairie.inviteDuo')}
              </button>
              <button
                type="button"
                onClick={() => router.push('/prairie')}
                className="flex-1 py-2 rounded-lg bg-slate-800/80 text-cyan-200 text-[11px] border border-slate-600/40 hover:bg-slate-800"
              >
                🌌 {t('social.lisiereBackPrairie')}
              </button>
            </div>
          </section>
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
