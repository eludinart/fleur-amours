// @ts-nocheck
'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, useMotionValue, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { prairieApi as prairie } from '@/api/prairie'
import { useStore } from '@/store/useStore'
import { FleurSociale } from '@/components/FleurSociale'
import { FOUR_DOORS } from '@/data/tarotCards'
import { t } from '@/i18n'
import { usePrairieForceLayout } from '@/hooks/usePrairieForceLayout'

const GrandJardinGalaxie = dynamic(
  () => import('@/components/GrandJardinGalaxie').then((m) => ({ default: m.GrandJardinGalaxie })),
  { ssr: false }
)

function slugify(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function PrairiePage() {
  const { user, refreshUser } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const storePoints = useStore((s) => s.pointsDeRosee)
  const setPointsDeRosee = useStore((s) => s.setPointsDeRosee)
  const pointsDeRosee = user?.points_de_rosee ?? storePoints
  const [fleurs, setFleurs] = useState([])
  const [meFleur, setMeFleur] = useState(null)
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedFleur, setSelectedFleur] = useState(null)
  const [showPollen, setShowPollen] = useState(false)
  const [arrosing, setArrosing] = useState(false)
  const [sendingPollen, setSendingPollen] = useState(false)
  const [feedbackArroser, setFeedbackArroser] = useState(null)
  const [feedbackPollen, setFeedbackPollen] = useState(null)
  const [positionOverrides, setPositionOverrides] = useState({})
  const [viewMode, setViewMode] = useState('prairie') // 'prairie' | 'galaxie'
  const [isDraggingFlower, setIsDraggingFlower] = useState(false)
  const justDraggedRef = useRef(false)
  const containerRef = useRef(null)
  const gardenRef = useRef(null)
  const galaxieContainerRef = useRef(null)
  const [containerSize, setContainerSize] = useState({ w: 600, h: 400 })
  const appliedUrlParamsRef = useRef(false)
  const storageKey = `prairie:positions:v1:${String(user?.id ?? '')}`
  const hasLoadedStorageRef = useRef(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? {}
      if (width > 0 && height > 0) setContainerSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const scale = useMotionValue(1)
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const meId = Number(meFleur?.user_id ?? user?.id) || 0
  /** Liens où je suis impliqué — pour le layout (proximité), plus de lignes visuelles */
  const myLinks = useMemo(
    () => links.filter((l) => Number(l.user_a) === meId || Number(l.user_b) === meId),
    [links, meId]
  )
  /** Layout : tous les liens pour former des nuages (fleurs liées proches, non liées éloignées) */
  const { positions: layoutPositions, settled: layoutSettled } = usePrairieForceLayout(fleurs, meFleur, links)

  const allFleurs = useMemo(() => {
    const pos = layoutSettled ? layoutPositions : {}
    const getPos = (uid) => {
      const override = positionOverrides[Number(uid)]
      if (override) return override
      return pos[Number(uid)] ?? pos[uid]
    }
    const byUserId = new Map()
    const selfUserId = Number(meFleur?.user_id ?? user?.id) || 0

    if (meFleur && selfUserId) {
      byUserId.set(selfUserId, {
        ...meFleur,
        user_id: selfUserId,
        position: getPos(selfUserId) ?? meFleur.position ?? { x: 0.5, y: 0.5 },
        is_me: true,
      })
    }

    fleurs.forEach((f) => {
      const uid = Number(f?.user_id)
      if (!uid) return
      if (uid === selfUserId) return // éviter le doublon "moi" qui ouvre ma propre Lisière
      if (byUserId.has(uid)) return
      byUserId.set(uid, {
        ...f,
        user_id: uid,
        position: getPos(uid) ?? f.position ?? { x: 0.5, y: 0.5 },
        is_me: !!f.is_me,
      })
    })

    return Array.from(byUserId.values())
  }, [meFleur, fleurs, layoutPositions, layoutSettled, positionOverrides, user?.id])

  const isPublic = user?.profile_public === true

  const fetchFleurs = useCallback(async (opts = {}) => {
    const background = !!opts.background
    if (!background) {
      setLoading(true)
      setError(null)
    }
    try {
      const data = await prairie.getFleurs()
      setFleurs(data?.fleurs ?? [])
      setMeFleur(data?.me_fleur ?? null)
      setLinks(data?.links ?? [])
    } catch (err) {
      if (!background) setError(err?.detail || err?.message || 'Erreur')
      setFleurs([])
      setMeFleur(null)
      setLinks([])
    } finally {
      if (!background) setLoading(false)
    }
  }, [])

  // Charger l'organisation personnalisée des fleurs (par utilisateur), une seule fois quand user est prêt
  useEffect(() => {
    if (!user?.id) return
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        // Normaliser les clés en number pour cohérence avec getPos(Number(uid))
        const next = {}
        for (const [k, v] of Object.entries(parsed)) {
          const uid = Number(k)
          if (!Number.isNaN(uid) && v && typeof v.x === 'number' && typeof v.y === 'number') {
            next[uid] = { x: v.x, y: v.y }
          }
        }
        if (Object.keys(next).length > 0) {
          setPositionOverrides(next)
        }
      }
    } catch {
      // no-op: format invalide ou storage indisponible
    }
    hasLoadedStorageRef.current = true
  }, [storageKey, user?.id])

  // Persister après un drag (ne jamais écrire {} pour ne pas écraser le storage au montage)
  useEffect(() => {
    if (!user?.id || !hasLoadedStorageRef.current) return
    if (Object.keys(positionOverrides).length === 0) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(positionOverrides))
    } catch {
      // no-op
    }
  }, [positionOverrides, storageKey, user?.id])

  useEffect(() => {
    const pts = user?.points_de_rosee
    if (typeof pts === 'number') setPointsDeRosee(pts)
  }, [user?.points_de_rosee, setPointsDeRosee])

  useEffect(() => {
    fetchFleurs()
  }, [fetchFleurs])

  // Ouvrir un profil depuis le lien Mon Sanctuaire (?profile=userId)
  useEffect(() => {
    if (appliedUrlParamsRef.current || loading) return
    const profileUserId = searchParams.get('profile')
    if (profileUserId && allFleurs.length > 0) {
      const fleur = allFleurs.find((f) => String(f.user_id) === profileUserId)
      if (fleur && !fleur.is_me) setSelectedFleur(fleur)
    }
    appliedUrlParamsRef.current = true
  }, [searchParams, loading, allFleurs])

  useEffect(() => {
    const onFocus = () => fetchFleurs()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [fetchFleurs])

  // Rafraîchir la présence (points verts / gris) toutes les 30 s
  useEffect(() => {
    if (!user) return
    const interval = setInterval(() => fetchFleurs({ background: true }), 30000)
    return () => clearInterval(interval)
  }, [user, fetchFleurs])

  useEffect(() => {
    const onEscape = (e) => { if (e.key === 'Escape') setSelectedFleur(null) }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      scale.set(Math.max(0.3, Math.min(2, scale.get() + delta)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [scale])

  async function handleArroser(fleur) {
    if (pointsDeRosee < 1) return
    setArrosing(true)
    try {
      await prairie.arroser(fleur.user_id)
      setFeedbackArroser({ fleurId: fleur.id, user_id: fleur.user_id })
      setTimeout(() => setFeedbackArroser(null), 1200)
      setPointsDeRosee(pointsDeRosee - 1)
      refreshUser?.()
      setSelectedFleur(null)
    } catch (err) {
      setError(err?.detail || err?.message)
    } finally {
      setArrosing(false)
    }
  }

  async function handlePollen(fleur, card) {
    setSendingPollen(true)
    try {
      const slug = slugify(card.name)
      await prairie.pollen(fleur.user_id, slug)
      setFeedbackPollen({ fleurId: fleur.id, cardName: card.name })
      setTimeout(() => setFeedbackPollen(null), 1400)
      setSelectedFleur(null)
      setShowPollen(false)
    } catch (err) {
      setError(err?.detail || err?.message)
    } finally {
      setSendingPollen(false)
    }
  }

  async function handleCreateLink(fleur) {
    try {
      await prairie.addLink(fleur.user_id)
      await fetchFleurs()
      setSelectedFleur(null)
    } catch (err) {
      setError(err?.detail || err?.message)
    }
  }

  async function handleRemoveLink(fleur) {
    try {
      await prairie.removeLink(fleur.user_id)
      await fetchFleurs()
      setSelectedFleur(null)
    } catch (err) {
      setError(err?.detail || err?.message)
    }
  }

  const updateFleurPositionFromPoint = useCallback((f, pointX, pointY) => {
    const el = gardenRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    // Conversion écran -> coordonnée logique utilisée par left/top:
    // left% = 36 + x*28 ; top% = 36 + y*28
    const pctX = ((pointX - rect.left) / rect.width) * 100
    const pctY = ((pointY - rect.top) / rect.height) * 100
    const logicalX = (pctX - 36) / 28
    const logicalY = (pctY - 36) / 28
    const newX = Math.max(0.02, Math.min(0.98, logicalX))
    const newY = Math.max(0.02, Math.min(0.98, logicalY))
    setPositionOverrides((prev) => ({ ...prev, [Number(f.user_id)]: { x: newX, y: newY } }))
  }, [])

  const isLinkedWith = (f) => {
    const fid = Number(f?.user_id)
    if (!meId || !fid) return false
    const ua = Math.min(meId, fid)
    const ub = Math.max(meId, fid)
    return myLinks.some((l) => Number(l.user_a) === ua && Number(l.user_b) === ub)
  }

  if (!isPublic) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 py-12">
        <span className="text-6xl mb-4">🌻</span>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          {t('prairie.grandJardin')}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 text-center max-w-sm">
          {t('prairie.activateToSee')}
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <span className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-[70dvh] flex flex-col overflow-hidden">
      <header className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <h1 className="text-lg font-bold bg-gradient-to-r from-violet-600 to-amber-500 bg-clip-text text-transparent">
          {t('prairie.grandJardin')}
        </h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <button
            type="button"
            onClick={() => fetchFleurs()}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
            title={t('prairie.refresh')}
          >
            🔄
          </button>
          {myLinks.length > 0 && (
            <span className="text-[10px] opacity-70" title={t('prairie.linksHint')}>🔗</span>
          )}
          <span title={t('prairie.pointsRosee')}>💧 {pointsDeRosee}</span>
          </div>
        </div>
      </header>

      {error && (
        <div className="shrink-0 px-4 py-2 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-sm">
          {error}
        </div>
      )}

      <div
        ref={containerRef}
        className="flex-1 min-h-[300px] overflow-hidden relative bg-gradient-to-br from-emerald-950/40 via-slate-900/60 to-violet-950/40"
        style={{ touchAction: viewMode === 'galaxie' ? 'none' : undefined }}
      >
        {viewMode === 'galaxie' ? (
          <div ref={galaxieContainerRef} className="absolute inset-0 w-full h-full">
            {allFleurs.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                <span className="text-4xl mb-2">🌌</span>
                <p className="text-sm">{t('prairie.noFleurs')}</p>
                <button
                  type="button"
                  onClick={() => fetchFleurs()}
                  disabled={loading}
                  className="mt-2 text-xs text-violet-500 hover:text-violet-400"
                >
                  🔄 {t('prairie.refresh')}
                </button>
              </div>
            ) : (
            <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-slate-500"><span className="animate-pulse">Chargement galaxie…</span></div>}>
              <GrandJardinGalaxie
                nodes={allFleurs}
                links={links}
                meId={meId}
                width={containerSize.w}
                height={containerSize.h}
                onNodeClick={(node) => {
                  if (node?.user_id === meId) return
                  setSelectedFleur(selectedFleur?.id === node?.id ? null : node)
                }}
                onBackgroundClick={() => setSelectedFleur(null)}
              />
            </Suspense>
            )}
            <AnimatePresence>
            {selectedFleur && (
              <motion.div
                className="absolute left-1/2 bottom-4 -translate-x-1/2 z-20 w-64 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-950 shadow-2xl p-4"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  {t('prairie.profile')}
                </p>
                <div className="flex items-center gap-3 mb-3">
                  <FleurSociale
                    scores={selectedFleur.scores}
                    lastActivityAt={selectedFleur.last_activity_at}
                    avatarEmoji={selectedFleur.avatar_emoji}
                    pseudo={selectedFleur.pseudo}
                    social={selectedFleur.social}
                    isOnline={!!selectedFleur?.presence?.is_online}
                    size={48}
                  />
                  <p className="font-medium text-slate-800 dark:text-slate-100 text-sm">
                    {selectedFleur.pseudo} {selectedFleur.avatar_emoji}
                  </p>
                </div>
                {!showPollen ? (
                  <>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleArroser(selectedFleur)}
                        disabled={pointsDeRosee < 1 || arrosing}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs"
                      >
                        💧 {t('prairie.arroser')}
                      </button>
                      <button
                        onClick={() => setShowPollen(true)}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs"
                      >
                        🌸 {t('prairie.envoyerPollen')}
                      </button>
                    </div>
<button
                                      type="button"
                                      onClick={() => {
                                        setSelectedFleur(null)
                                        router.push(`/lisiere/${selectedFleur.user_id}`)
                                      }}
                                      className="w-full mt-2 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs"
                                    >
                                      🌿 {t('social.voirLisiere')}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedFleur(null)
                                        router.push(`/jardin/duo?invite_user_id=${selectedFleur.user_id}&invite_pseudo=${encodeURIComponent(selectedFleur.pseudo || '')}`)
                                      }}
                                      className="w-full mt-1.5 px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-700 dark:text-violet-300 text-xs"
                                    >
                                      💕 {t('prairie.inviteDuo')}
                                    </button>
                  </>
                ) : (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                      Choisir une carte :
                    </p>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {FOUR_DOORS.map((door) => (
                        <div key={door.key} className="space-y-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 sticky top-0 bg-white dark:bg-slate-800 py-0.5 z-10">
                            {door.subtitle}
                          </p>
                          <div className="grid grid-cols-4 gap-1.5">
                            {door.group.map((card) => (
                              <button
                                key={`${door.key}-${card.name}`}
                                type="button"
                                onClick={() => handlePollen(selectedFleur, card)}
                                disabled={sendingPollen}
                                title={card.name}
                                className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-violet-300 dark:hover:border-violet-500 transition-colors text-left"
                              >
                                <img
                                  src={card.img}
                                  alt={card.name}
                                  loading="lazy"
                                  className="w-full aspect-[3/4] object-cover"
                                />
                                <span className="block px-1 py-0.5 text-[9px] leading-tight text-slate-700 dark:text-slate-200 truncate">
                                  {card.name}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowPollen(false)}
                      className="mt-1.5 text-[10px] text-slate-500 hover:text-slate-700"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        ) : (
        <motion.div
          className="absolute inset-0 w-[300%] h-[300%] -left-[100%] -top-[100%] bg-gradient-to-br from-emerald-50/80 via-amber-50/50 to-violet-50/60 dark:from-emerald-950/20 dark:via-slate-900/40 dark:to-violet-950/20"
          style={{
            x,
            y,
            scale,
            originX: 0.5,
            originY: 0.5,
          }}
          drag={!isDraggingFlower}
          dragMomentum={false}
        >
          <div
            ref={gardenRef}
            className={`absolute inset-0 flex items-center justify-center ${allFleurs.length === 0 ? 'pointer-events-none' : ''}`}
            onClick={() => selectedFleur && setSelectedFleur(null)}
            role="presentation"
          >
            {allFleurs.length === 0 ? (
              <div className="pointer-events-auto text-center px-6 py-8 rounded-2xl bg-white/5 dark:bg-white/5 border border-slate-700/50 backdrop-blur-sm max-w-sm">
                <span className="text-5xl mb-3 block">🌻</span>
                <p className="text-slate-300 dark:text-slate-300 text-base font-medium mb-2">
                  {t('prairie.noFleurs')}
                </p>
                <p className="text-slate-500 dark:text-slate-500 text-sm mb-3">
                  {t('prairie.noFleursHint')}
                </p>
                <button
                  type="button"
                  onClick={() => fetchFleurs()}
                  disabled={loading}
                  className="text-sm text-violet-400 hover:text-violet-300 font-medium"
                >
                  🔄 {t('prairie.refresh')}
                </button>
              </div>
            ) : (
              <>
                <AnimatePresence>
                  {allFleurs.map((f, idx) => (
                    <motion.div
                      key={f.id ?? f.user_id ?? `fleur-${idx}`}
                      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing"
                      style={{
                        left: `${36 + (f.position?.x ?? 0) * 28}%`,
                        top: `${36 + (f.position?.y ?? 0) * 28}%`,
                        zIndex: selectedFleur?.id === f.id ? 60 : (f.is_me ? 10 : 5),
                      }}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      whileDrag={{ scale: 1.04 }}
                      transition={{ type: 'spring', stiffness: 140, damping: 26, delay: layoutSettled ? 0 : idx * 0.03 }}
                      drag
                      dragMomentum={false}
                      dragElastic={0.04}
                      dragPropagation={false}
                      onDragStart={() => {
                        justDraggedRef.current = false
                        setIsDraggingFlower(true)
                      }}
                      onDrag={(_, info) => {
                        updateFleurPositionFromPoint(f, info.point.x, info.point.y)
                      }}
                      onDragEnd={(_, info) => {
                        updateFleurPositionFromPoint(f, info.point.x, info.point.y)
                        setIsDraggingFlower(false)
                        justDraggedRef.current = true
                        setTimeout(() => { justDraggedRef.current = false }, 100)
                      }}
                      onClick={(e) => {
                        if (f.is_me) return
                        e.stopPropagation()
                        if (justDraggedRef.current) return
                        setSelectedFleur(selectedFleur?.id === f.id ? null : f)
                      }}
                    >
                      {!f.is_me && selectedFleur?.id === f.id && (
                        <motion.div
                          className={`absolute left-1/2 -translate-x-1/2 z-[70] w-56 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-950 shadow-2xl p-3 ${((f.position?.y ?? 0) > 0.5) ? 'bottom-full mb-2' : 'top-full mt-2'}`}
                          data-flower-popover
                          onClick={(e) => e.stopPropagation()}
                          initial={{ opacity: 0, scale: 0.9, y: (f.position?.y ?? 0) > 0.5 ? 4 : -4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                        >
                          <p className="font-medium text-slate-800 dark:text-slate-100 text-sm mb-1">
                            {f.pseudo} {f.avatar_emoji}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                            {t('prairie.pointsRosee')}: {pointsDeRosee}
                          </p>
                          {!showPollen ? (
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleArroser(f)}
                                  disabled={pointsDeRosee < 1 || arrosing}
                                  className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50 text-xs font-medium"
                                >
                                  💧 {t('prairie.arroser')}
                                </button>
                                <button
                                  onClick={() => setShowPollen(true)}
                                  className="flex-1 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-500/30 text-xs font-medium"
                                >
                                  🌸 {t('prairie.envoyerPollen')}
                                </button>
                              </div>
                              <div className="border-t border-slate-200 dark:border-slate-600 pt-2 space-y-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedFleur(null)
                                    setShowPollen(false)
                                    router.push(`/lisiere/${f.user_id}`)
                                  }}
                                  className="w-full px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/30 text-xs font-medium text-left"
                                >
                                  🌿 {t('social.voirLisiere')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedFleur(null)
                                    setShowPollen(false)
                                    router.push(`/duo?invite_user_id=${f.user_id}&invite_pseudo=${encodeURIComponent(f.pseudo || '')}`)
                                  }}
                                  className="w-full px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-700 dark:text-violet-300 hover:bg-violet-500/30 text-xs font-medium text-left"
                                  title={t('prairie.inviteDuoHint')}
                                >
                                  💕 {t('prairie.inviteDuo')}
                                </button>
                                {isLinkedWith(f) ? (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveLink(f)}
                                    className="w-full px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-700 dark:text-rose-400 hover:bg-rose-500/30 text-xs font-medium text-left"
                                    title={t('prairie.removeLinkHint')}
                                  >
                                    🔗✕ {t('prairie.removeLink')}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleCreateLink(f)}
                                    className="w-full px-3 py-1.5 rounded-lg bg-slate-500/15 text-slate-600 dark:text-slate-400 hover:bg-slate-500/25 text-xs font-medium text-left"
                                    title={t('prairie.createLinkHint')}
                                  >
                                    🔗 {t('prairie.createLink')}
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                                Choisir une carte :
                              </p>
                              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                {FOUR_DOORS.map((door) => (
                                  <div key={door.key} className="space-y-1.5">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 sticky top-0 bg-white dark:bg-slate-800 py-0.5 z-10">
                                      {door.subtitle}
                                    </p>
                                    <div className="grid grid-cols-4 gap-1.5">
                                      {door.group.map((card) => (
                                        <button
                                          key={`${door.key}-${card.name}`}
                                          type="button"
                                          onClick={() => handlePollen(f, card)}
                                          disabled={sendingPollen}
                                          title={card.name}
                                          className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-violet-300 dark:hover:border-violet-500 transition-colors text-left"
                                        >
                                          <img
                                            src={card.img}
                                            alt={card.name}
                                            loading="lazy"
                                            className="w-full aspect-[3/4] object-cover"
                                          />
                                          <span className="block px-1 py-0.5 text-[9px] leading-tight text-slate-700 dark:text-slate-200 truncate">
                                            {card.name}
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <button
                                onClick={() => setShowPollen(false)}
                                className="mt-1.5 text-[10px] text-slate-500 hover:text-slate-700"
                              >
                                {t('common.cancel')}
                              </button>
                            </div>
                          )}
                        </motion.div>
                      )}
                      <div className="relative">
                        <FleurSociale
                          scores={f.scores}
                          lastActivityAt={f.last_activity_at}
                          size={f.is_me ? 52 : 44}
                          avatarEmoji={f.avatar_emoji}
                          pseudo={f.pseudo}
                          social={f.social}
                          isOnline={!!f?.presence?.is_online}
                          showPseudo
                          isMe={!!f.is_me}
                          isSelected={selectedFleur?.id === f.id}
                          onClick={f.is_me ? undefined : () => { if (!justDraggedRef.current) setSelectedFleur(selectedFleur?.id === f.id ? null : f) }}
                        />
                        {feedbackArroser?.fleurId === f.id && (
                          <motion.div
                            className="absolute inset-0 pointer-events-none flex items-center justify-center"
                            initial={{ opacity: 1 }}
                            animate={{ opacity: 0 }}
                            transition={{ duration: 1.2 }}
                          >
                            {[...Array(6)].map((_, i) => (
                              <motion.span
                                key={i}
                                className="absolute text-lg"
                                initial={{ y: 0, opacity: 1, scale: 1 }}
                                animate={{
                                  y: -25 - (i % 3) * 12,
                                  x: (i - 2.5) * 14,
                                  opacity: 0,
                                  scale: 0.6,
                                }}
                                transition={{ duration: 1, delay: i * 0.06 }}
                                style={{ left: '50%', top: '50%' }}
                              >
                                💧
                              </motion.span>
                            ))}
                          </motion.div>
                        )}
                        {feedbackPollen?.fleurId === f.id && (
                          <motion.div
                            className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-visible"
                            initial={{ opacity: 1 }}
                            animate={{ opacity: 0 }}
                            transition={{ duration: 1.4 }}
                          >
                            {[...Array(8)].map((_, i) => (
                              <motion.span
                                key={i}
                                className="absolute text-sm"
                                initial={{ scale: 0, opacity: 1, x: 0, y: 0 }}
                                animate={{
                                  scale: [0, 1.2, 0.8],
                                  opacity: [1, 0.9, 0],
                                  x: Math.cos((i / 8) * Math.PI * 2) * 40,
                                  y: Math.sin((i / 8) * Math.PI * 2) * 40 - 20,
                                }}
                                transition={{ duration: 1.2, delay: i * 0.04 }}
                                style={{ left: '50%', top: '50%' }}
                              >
                                🌸
                              </motion.span>
                            ))}
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </>
            )}
          </div>
        </motion.div>
        )}
      </div>
    </div>
  )
}
