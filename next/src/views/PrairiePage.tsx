// @ts-nocheck
'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { prairieApi as prairie } from '@/api/prairie'
import { socialApi } from '@/api/social'
import { useStore } from '@/store/useStore'
import { FleurSociale } from '@/components/FleurSociale'
import { scoresToPetals } from '@/components/FlowerSVG'
import { FOUR_DOORS } from '@/data/tarotCards'
import { t } from '@/i18n'
import { JardinPhaser } from '@/components/JardinPhaser'
import { PETAL_DEFS, PETAL_BY_ID } from '@/lib/petal-theme'
import { dominantPetalId } from '@/lib/petal-tarot'
import { AstrolabeOverlay } from '@/components/AstrolabeOverlay'
import { loadGalaxieView, resonanceBetween } from '@/lib/grand-jardin-view'

const GrandJardinGalaxie = dynamic(
  () => import('@/components/GrandJardinGalaxie').then((m) => ({ default: m.GrandJardinGalaxie })),
  { ssr: false }
)

const NEIGHBORHOOD_RESONANCE = 0.55
const MODERATE_RESONANCE = 0.38

function slugify(name) {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function formatActivityAgo(iso) {
  if (!iso) return null
  const ts = new Date(iso).getTime()
  if (!Number.isFinite(ts)) return null
  const days = Math.floor((Date.now() - ts) / 86400000)
  if (days <= 0) return t('prairie.profileActivityToday')
  if (days === 1) return t('prairie.profileActivityYesterday')
  if (days < 7) return t('prairie.profileActivityDays', { count: days })
  return new Date(ts).toLocaleDateString()
}

function topPetalsFromScores(scores, limit = 3) {
  const petals = scoresToPetals(scores)
  return PETAL_DEFS
    .map((p) => ({ id: p.id, name: p.name, value: petals[p.id] ?? 0, color: p.color }))
    .filter((p) => p.value > 0.04)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

/** Place un panneau ancré près d'un nœud tout en restant entièrement visible. */
function clampPanelNearAnchor(anchorX, anchorY, panelW, panelH, viewW, viewH, gap = 16) {
  const margin = 12
  const candidates = [
    { left: anchorX + gap, top: anchorY + gap },
    { left: anchorX - panelW - gap, top: anchorY + gap },
    { left: anchorX - panelW / 2, top: anchorY + gap + 10 },
    { left: anchorX + gap, top: anchorY - panelH - gap },
    { left: anchorX - panelW / 2, top: anchorY - panelH - gap - 10 },
    { left: anchorX + gap + 8, top: anchorY - panelH / 2 },
    { left: anchorX - panelW - gap - 8, top: anchorY - panelH / 2 },
  ]
  for (const pos of candidates) {
    const left = pos.left
    const top = pos.top
    if (
      left >= margin && top >= margin
      && left + panelW <= viewW - margin
      && top + panelH <= viewH - margin
    ) {
      return { left, top }
    }
  }
  return {
    left: Math.max(margin, Math.min(anchorX + gap, viewW - panelW - margin)),
    top: Math.max(margin, Math.min(anchorY + gap, viewH - panelH - margin)),
  }
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
  const [profilePreview, setProfilePreview] = useState(null)
  const [profilePreviewLoading, setProfilePreviewLoading] = useState(false)
  const [showPollen, setShowPollen] = useState(false)
  const [arrosing, setArrosing] = useState(false)
  const [sendingPollen, setSendingPollen] = useState(false)
  const [feedbackArroser, setFeedbackArroser] = useState(null)
  const [feedbackPollen, setFeedbackPollen] = useState(null)
  const containerRef = useRef(null)
  const galaxieContainerRef = useRef(null)
  const [containerSize, setContainerSize] = useState({ w: 600, h: 400 })
  const galaxieRef = useRef(null)
  const profilePanelRef = useRef(null)
  const [panelPos, setPanelPos] = useState({ left: 12, top: 12 })
  const [galaxieCameraTick, setGalaxieCameraTick] = useState(0)
  const [galaxieFilter, setGalaxieFilter] = useState('all')
  const [galaxiePetal, setGalaxiePetal] = useState('')
  const [galaxieSearch, setGalaxieSearch] = useState('')
  const [controlsCollapsed, setControlsCollapsed] = useState(false)
  const [bgPhase, setBgPhase] = useState(0)
  const appliedUrlParamsRef = useRef(false)
  const viewRestoredRef = useRef(false)

  useEffect(() => {
    if (viewRestoredRef.current) return
    const saved = loadGalaxieView()
    if (saved?.filterMode) setGalaxieFilter(saved.filterMode)
    if (saved?.petalFilter) setGalaxiePetal(saved.petalFilter)
    if (saved?.neighborhood) setGalaxieFilter('neighborhood')
    viewRestoredRef.current = true
  }, [])

  useEffect(() => {
    const id = setInterval(() => setBgPhase((p) => p + 1), 12000)
    return () => clearInterval(id)
  }, [])

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

  const meId = Number(meFleur?.user_id ?? user?.id) || 0
  const renderer = (searchParams.get('renderer') || 'dom').toLowerCase()
  const usePhaser = renderer === 'phaser'
  /** Liens où je suis impliqué — ast en en-tête ; le rendu galaxie reçoit `links` complet */
  const myLinks = useMemo(
    () => links.filter((l) => Number(l.user_a) === meId || Number(l.user_b) === meId),
    [links, meId]
  )

  const isLinkedWithSelected = useMemo(() => {
    if (!selectedFleur || !meId) return false
    const uid = Number(selectedFleur.user_id)
    return links.some((l) =>
      (Number(l.user_a) === meId && Number(l.user_b) === uid)
      || (Number(l.user_b) === meId && Number(l.user_a) === uid))
  }, [selectedFleur, meId, links])

  useEffect(() => {
    if (!selectedFleur?.user_id || Number(selectedFleur.user_id) === meId) {
      setProfilePreview(null)
      setProfilePreviewLoading(false)
      return
    }
    let cancelled = false
    setProfilePreviewLoading(true)
    socialApi.visitLisiere(String(selectedFleur.user_id))
      .then((data) => { if (!cancelled) setProfilePreview(data) })
      .catch(() => { if (!cancelled) setProfilePreview(null) })
      .finally(() => { if (!cancelled) setProfilePreviewLoading(false) })
    return () => { cancelled = true }
  }, [selectedFleur?.user_id, meId])

  const allFleurs = useMemo(() => {
    const byUserId = new Map()
    const selfUserId = Number(meFleur?.user_id ?? user?.id) || 0

    if (meFleur && selfUserId) {
      byUserId.set(selfUserId, {
        ...meFleur,
        user_id: selfUserId,
        position: meFleur.position ?? { x: 0.5, y: 0.5 },
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
        position: f.position ?? { x: 0.5, y: 0.5 },
        is_me: !!f.is_me,
      })
    })

    return Array.from(byUserId.values())
  }, [meFleur, fleurs, user?.id])

  const astrolabeModel = useMemo(() => {
    const petals = PETAL_DEFS.map((p) => p.id)
    const selfUserId = meId
    const me = allFleurs.find((f) => Number(f.user_id) === selfUserId || f.is_me)
    const contactIds = new Set()
    links.forEach((l) => {
      if (Number(l.user_a) === selfUserId) contactIds.add(Number(l.user_b))
      if (Number(l.user_b) === selfUserId) contactIds.add(Number(l.user_a))
    })

    const others = allFleurs.filter((f) => Number(f.user_id) !== selfUserId && !f.is_me)
    const withMeta = others.map((f) => ({
      fleur: f,
      resonance: resonanceBetween(me?.scores, f?.scores),
      isContact: contactIds.has(Number(f.user_id)),
    }))

    let ecosystemEntries = withMeta.filter((x) => x.isContact || x.resonance >= NEIGHBORHOOD_RESONANCE)
    if (ecosystemEntries.length < 4) {
      const seen = new Set(ecosystemEntries.map((x) => x.fleur.user_id))
      for (const x of withMeta) {
        if (seen.has(x.fleur.user_id)) continue
        if (x.resonance >= MODERATE_RESONANCE) {
          ecosystemEntries.push(x)
          seen.add(x.fleur.user_id)
        }
        if (ecosystemEntries.length >= 8) break
      }
    }
    if (ecosystemEntries.length === 0) ecosystemEntries = withMeta.slice(0, Math.min(12, withMeta.length))

    const ecosystemFleurs = ecosystemEntries.map((x) => x.fleur)
    const ecosystemCount = ecosystemFleurs.length
    const ecosystemIds = new Set(ecosystemFleurs.map((f) => Number(f.user_id)))
    ecosystemIds.add(selfUserId)

    const totals = Object.fromEntries(petals.map((p) => [p, 0]))
    let onlineInEco = 0
    ecosystemFleurs.forEach((f) => {
      if (f?.presence?.is_online || f?.is_online) onlineInEco++
      petals.forEach((p) => { totals[p] += Number(f?.scores?.[p] ?? 0) })
    })

    const ecoDenom = Math.max(1, ecosystemCount)
    const avgByPetal = Object.fromEntries(petals.map((p) => [p, totals[p] / ecoDenom]))
    const dominantPetal =
      petals.reduce((best, p) => (avgByPetal[p] > avgByPetal[best] ? p : best), petals[0]) || 'agape'
    const myDominantPetal = dominantPetalId(scoresToPetals(me?.scores ?? {}))

    const meanPetal = petals.reduce((sum, p) => sum + avgByPetal[p], 0) / petals.length
    const health = Math.min(100, Math.round((meanPetal / 3) * 100))
    const myLinksCount = myLinks.length
    const synergy = Math.min(100, Math.round(ecosystemCount > 0 ? (myLinksCount / ecosystemCount) * 100 : 0))

    const ecoLinks = links.filter((l) => {
      const a = Number(l.user_a)
      const b = Number(l.user_b)
      return ecosystemIds.has(a) && ecosystemIds.has(b)
    })
    const flows = Math.min(
      100,
      Math.round(
        ecosystemCount > 0
          ? (onlineInEco / ecosystemCount) * 70 + (ecoLinks.length / Math.max(1, ecosystemCount)) * 30
          : 0,
      ),
    )

    const names = ecosystemFleurs
      .map((f) => String(f?.pseudo ?? '').trim())
      .filter(Boolean)
      .slice(0, 6)

    return {
      ecosystemHealth: health,
      synergyCore: synergy,
      permacultureFlows: flows,
      fleursCount: allFleurs.length,
      ecosystemCount,
      linksCount: links.length,
      myLinksCount,
      ecoLinksCount: ecoLinks.length,
      onlineCount: onlineInEco,
      pointsDeRosee: Number(pointsDeRosee ?? 0),
      dominantPetal,
      dominantPetalName: PETAL_BY_ID[dominantPetal]?.name ?? dominantPetal,
      myDominantPetal,
      myDominantPetalName: PETAL_BY_ID[myDominantPetal]?.name ?? myDominantPetal,
      meanPetalScore: Math.round(meanPetal * 10) / 10,
      names,
    }
  }, [allFleurs, links, myLinks, meId, meFleur, pointsDeRosee])

  const isPublic = user?.profile_public === true

  const lastFetchedAtRef = useRef<number>(0)
  const fetchingRef = useRef(false)

  const fetchFleurs = useCallback(async (opts = {}) => {
    const background = !!opts.background
    // Éviter les appels parallèles
    if (fetchingRef.current) return
    // Pour les refreshs en arrière-plan, ne pas relancer si un fetch récent (<55s)
    if (background && Date.now() - lastFetchedAtRef.current < 55_000) return
    fetchingRef.current = true
    if (!background) {
      setLoading(true)
      setError(null)
    }
    try {
      const data = await prairie.getFleurs()
      lastFetchedAtRef.current = Date.now()
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
      fetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    const pts = user?.points_de_rosee
    if (typeof pts === 'number') setPointsDeRosee(pts)
  }, [user?.points_de_rosee, setPointsDeRosee])

  useEffect(() => {
    fetchFleurs()
  }, [fetchFleurs])

  // Ouvrir un profil depuis le lien Mon Jardin (?profile=userId)
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
    // Refresh sur focus uniquement si la dernière synchro date de plus de 60s
    const onFocus = () => fetchFleurs({ background: true })
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [fetchFleurs])

  // Rafraîchir la présence (points verts / gris) toutes les 60 s
  useEffect(() => {
    if (!user) return
    const interval = setInterval(() => fetchFleurs({ background: true }), 60_000)
    return () => clearInterval(interval)
  }, [user, fetchFleurs])

  const handleGalaxieSearch = useCallback(() => {
    const q = galaxieSearch.trim().toLowerCase()
    if (!q) return
    const match = allFleurs.find((f) => String(f?.pseudo ?? '').toLowerCase().includes(q))
    if (!match || match.is_me) return
    setShowPollen(false)
    setSelectedFleur(match)
  }, [galaxieSearch, allFleurs])

  const dismissProfilePanel = useCallback(() => {
    setSelectedFleur(null)
    setShowPollen(false)
  }, [])

  const handleSelectFleur = useCallback((node) => {
    if (!node || Number(node.user_id) === meId) return
    const isSame = Number(selectedFleur?.id) === Number(node.id)
      || Number(selectedFleur?.user_id) === Number(node.user_id)
    setShowPollen(false)
    setSelectedFleur(isSame ? null : node)
  }, [meId, selectedFleur])

  const refreshPanelPosition = useCallback(() => {
    if (!selectedFleur) return
    const { w: viewW, h: viewH } = containerSize
    if (viewW <= 0 || viewH <= 0) return

    let anchor = null
    if (!usePhaser) {
      anchor = galaxieRef.current?.getNodeScreenPosition?.(selectedFleur.user_id)
    }
    if (!anchor) {
      setPanelPos({
        left: Math.max(12, viewW / 2 - 128),
        top: Math.max(12, viewH - (showPollen ? 340 : 200)),
      })
      return
    }

    const el = profilePanelRef.current
    const pw = el?.offsetWidth || 288
    const ph = el?.offsetHeight || (showPollen ? 360 : 280)
    setPanelPos(clampPanelNearAnchor(anchor.x, anchor.y, pw, ph, viewW, viewH))
  }, [selectedFleur, containerSize, showPollen, usePhaser, galaxieCameraTick])

  useLayoutEffect(() => {
    refreshPanelPosition()
  }, [refreshPanelPosition])

  useEffect(() => {
    if (!selectedFleur || !profilePanelRef.current) return
    const ro = new ResizeObserver(() => refreshPanelPosition())
    ro.observe(profilePanelRef.current)
    return () => ro.disconnect()
  }, [selectedFleur, refreshPanelPosition])

  useEffect(() => {
    const onEscape = (e) => { if (e.key === 'Escape') dismissProfilePanel() }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [dismissProfilePanel])

  const handleAstrolabeFilter = useCallback((action) => {
    if (action.type === 'petal') {
      setGalaxiePetal((prev) => (prev === action.petalId ? '' : action.petalId))
      return
    }
    if (action.type === 'filter') {
      setGalaxieFilter((prev) => (prev === action.mode ? 'all' : action.mode))
      return
    }
    if (action.type === 'clear') {
      setGalaxieFilter('all')
      setGalaxiePetal('')
    }
  }, [])

  async function handleArroser(fleur) {
    if (pointsDeRosee < 1) return
    setArrosing(true)
    try {
      await prairie.arroser(fleur.user_id)
      setFeedbackArroser({ fleurId: fleur.id, user_id: fleur.user_id })
      setTimeout(() => setFeedbackArroser(null), 1200)
      setPointsDeRosee(pointsDeRosee - 1)
      refreshUser?.()
      dismissProfilePanel()
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
      dismissProfilePanel()
    } catch (err) {
      setError(err?.detail || err?.message)
    } finally {
      setSendingPollen(false)
    }
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
        className="flex-1 min-h-[300px] overflow-hidden relative bg-gradient-to-br from-[#050b1a] via-[#0a1630] to-[#070d22]"
        style={{ touchAction: 'none' }}
      >
          <div ref={galaxieContainerRef} className="absolute inset-0 w-full h-full">
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-[12s] ease-in-out"
              aria-hidden
              style={{
                backgroundImage: [
                  `radial-gradient(700px 500px at ${18 + (bgPhase % 3) * 2}% ${14 + (bgPhase % 2) * 3}%, rgba(100,116,180,0.08), transparent 65%)`,
                  `radial-gradient(600px 420px at ${80 - (bgPhase % 2) * 2}% ${28 + (bgPhase % 3)}%, rgba(34,211,238,0.06), transparent 68%)`,
                  `radial-gradient(500px 400px at 48% ${82 - (bgPhase % 2) * 2}%, rgba(251,191,36,0.05), transparent 65%)`,
                  'radial-gradient(1.2px 1.2px at 12% 26%, rgba(255,255,255,0.14), transparent 62%)',
                  'radial-gradient(1px 1px at 22% 68%, rgba(255,255,255,0.10), transparent 62%)',
                  'radial-gradient(1.6px 1.6px at 78% 62%, rgba(255,255,255,0.12), transparent 62%)',
                  'radial-gradient(1px 1px at 62% 18%, rgba(255,255,255,0.08), transparent 62%)',
                  'radial-gradient(1.3px 1.3px at 90% 78%, rgba(255,255,255,0.07), transparent 62%)',
                ].join(','),
                filter: 'saturate(0.95) contrast(1.02)',
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              aria-hidden
              style={{
                background:
                  'radial-gradient(1000px 700px at 50% 55%, rgba(2,6,23,0.02), rgba(2,6,23,0.28) 72%, rgba(2,6,23,0.55) 100%)',
              }}
            />
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
              {usePhaser ? (
                <JardinPhaser
                  fleurs={allFleurs}
                  links={links}
                  meId={meId}
                  selectedUserId={selectedFleur?.user_id ?? null}
                  width={containerSize.w}
                  height={containerSize.h}
                  onSelectUserId={(uid) => {
                    const fleur = allFleurs.find((f) => Number(f?.user_id) === Number(uid))
                    if (fleur) handleSelectFleur(fleur)
                  }}
                  onBackgroundClick={dismissProfilePanel}
                />
              ) : (
                <GrandJardinGalaxie
                  ref={galaxieRef}
                  nodes={allFleurs}
                  links={links}
                  meId={meId}
                  selectedUserId={selectedFleur?.user_id ?? null}
                  filterMode={galaxieFilter}
                  petalFilter={galaxiePetal}
                  searchQuery={galaxieSearch}
                  onCameraChange={() => setGalaxieCameraTick((n) => n + 1)}
                  onNodeClick={handleSelectFleur}
                  onBackgroundClick={dismissProfilePanel}
                />
              )}
            </Suspense>
            )}
            {!usePhaser && allFleurs.length > 0 && (
              <div className="absolute top-3 left-3 z-20 flex flex-col gap-2 max-w-[min(100%,22rem)] pointer-events-auto">
                <button
                  type="button"
                  className="md:hidden self-start px-2 py-1 rounded-lg text-[10px] text-slate-300 bg-slate-950/72 border border-slate-600/40"
                  onClick={() => setControlsCollapsed((v) => !v)}
                  aria-expanded={!controlsCollapsed}
                >
                  {controlsCollapsed ? t('prairie.controlsShow') : t('prairie.controlsHide')} ▾
                </button>
                <div className={`flex flex-col gap-2 ${controlsCollapsed ? 'max-md:hidden' : ''}`}>
                <div className="flex flex-wrap gap-1.5 p-2 rounded-xl border border-slate-600/40 bg-slate-950/72 backdrop-blur-md shadow-lg">
                  {[
                    { id: 'all', label: t('prairie.filterAll') },
                    { id: 'contacts', label: t('prairie.filterContacts') },
                    { id: 'online', label: t('prairie.filterOnline') },
                    { id: 'neighborhood', label: t('prairie.filterNeighborhood') },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setGalaxieFilter((prev) => (prev === opt.id ? 'all' : opt.id))}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                        galaxieFilter === opt.id
                          ? 'bg-violet-500/30 text-violet-100 border border-violet-400/40'
                          : 'text-slate-300 hover:bg-slate-800/80 border border-transparent'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl border border-slate-600/40 bg-slate-950/72 backdrop-blur-md shadow-lg">
                  <select
                    value={galaxiePetal}
                    onChange={(e) => setGalaxiePetal(e.target.value)}
                    className="flex-1 min-w-[7rem] px-2 py-1 rounded-lg text-[11px] bg-slate-900/90 text-slate-200 border border-slate-600/50"
                    aria-label={t('prairie.filterPetal')}
                  >
                    <option value="">{t('prairie.filterPetalAll')}</option>
                    {PETAL_DEFS.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => galaxieRef.current?.centerOnMe?.()}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-amber-100 bg-amber-500/20 border border-amber-400/30 hover:bg-amber-500/30"
                    title={t('prairie.centerOnMe')}
                  >
                    ◎ {t('prairie.centerOnMe')}
                  </button>
                  <button
                    type="button"
                    onClick={() => galaxieRef.current?.resetView?.()}
                    className="px-2 py-1 rounded-lg text-[11px] text-slate-300 hover:bg-slate-800/80 border border-slate-600/40"
                    title={t('prairie.resetView')}
                  >
                    ↺
                  </button>
                </div>
                <div className="flex gap-1.5 p-2 rounded-xl border border-slate-600/40 bg-slate-950/72 backdrop-blur-md shadow-lg">
                  <input
                    type="search"
                    value={galaxieSearch}
                    onChange={(e) => setGalaxieSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleGalaxieSearch() }}
                    placeholder={t('prairie.searchPlaceholder')}
                    className="flex-1 min-w-0 px-2.5 py-1 rounded-lg text-[11px] bg-slate-900/90 text-slate-200 border border-slate-600/50 placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={handleGalaxieSearch}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-cyan-100 bg-cyan-500/20 border border-cyan-400/30 hover:bg-cyan-500/30"
                  >
                    {t('prairie.searchGo')}
                  </button>
                </div>
                <p className="hidden md:block text-[9px] text-slate-500 px-1">{t('prairie.keyboardHint')}</p>
                </div>
              </div>
            )}
            <AstrolabeOverlay
              width={containerSize.w}
              height={containerSize.h}
              variant="organic"
              model={astrolabeModel}
              activePetalFilter={galaxiePetal}
              activeFilterMode={galaxieFilter}
              onFilterAction={handleAstrolabeFilter}
              className="z-[3]"
            />
            <AnimatePresence>
            {selectedFleur && (() => {
              const dominantId = dominantPetalId(scoresToPetals(selectedFleur.scores))
              const dominantDef = dominantId ? PETAL_BY_ID[dominantId] : null
              const topPetals = topPetalsFromScores(selectedFleur.scores)
              const activityLabel = formatActivityAgo(selectedFleur.last_activity_at)
              const isOnline = !!selectedFleur?.presence?.is_online
              const relation = profilePreview?.relationStatusWithVisitor
                || (isLinkedWithSelected ? 'accepted' : 'none')
              const social = selectedFleur.social ?? profilePreview?.social
              const openLisiere = () => router.push(`/lisiere/${selectedFleur.user_id}`)

              return (
              <motion.div
                ref={profilePanelRef}
                className="absolute z-30 w-72 max-w-[calc(100%-24px)] rounded-xl border border-slate-600/50 bg-slate-950/94 backdrop-blur-md shadow-2xl p-3 pointer-events-auto"
                style={{ left: panelPos.left, top: panelPos.top }}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
              >
                <button
                  type="button"
                  onClick={openLisiere}
                  className="w-full flex items-center gap-2.5 mb-2.5 text-left rounded-lg hover:bg-slate-800/55 p-1.5 -mx-0.5 transition-colors group"
                >
                  <FleurSociale
                    scores={selectedFleur.scores}
                    lastActivityAt={selectedFleur.last_activity_at}
                    avatarEmoji={selectedFleur.avatar_emoji}
                    pseudo={selectedFleur.pseudo}
                    social={selectedFleur.social}
                    isOnline={isOnline}
                    size={44}
                    variant="portrait"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-amber-50 text-sm truncate group-hover:text-amber-100">
                      {selectedFleur.pseudo} {selectedFleur.avatar_emoji}
                    </p>
                    <p className="text-[10px] text-cyan-300/80 group-hover:text-cyan-200/90">
                      {t('prairie.profileViewFull')} →
                    </p>
                  </div>
                </button>

                <div className="flex flex-wrap gap-1 mb-2.5">
                  {isOnline ? (
                    <span className="px-1.5 py-0.5 rounded-md text-[9px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                      ● {t('prairie.profileOnline')}
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded-md text-[9px] text-slate-400 border border-slate-600/40">
                      {t('prairie.profileOffline')}
                    </span>
                  )}
                  {dominantDef && (
                    <span
                      className="px-1.5 py-0.5 rounded-md text-[9px] font-medium border"
                      style={{
                        color: dominantDef.color,
                        borderColor: `${dominantDef.color}55`,
                        backgroundColor: `${dominantDef.color}18`,
                      }}
                    >
                      {dominantDef.name}
                    </span>
                  )}
                  {relation === 'accepted' && (
                    <span className="px-1.5 py-0.5 rounded-md text-[9px] font-medium bg-violet-500/15 text-violet-300 border border-violet-500/25">
                      {t('prairie.profileRelationDuo')}
                    </span>
                  )}
                  {relation === 'pending_out' && (
                    <span className="px-1.5 py-0.5 rounded-md text-[9px] text-amber-300/90 border border-amber-500/30">
                      {t('prairie.profileRelationPending')}
                    </span>
                  )}
                  {relation === 'pending_in' && (
                    <span className="px-1.5 py-0.5 rounded-md text-[9px] text-amber-200 border border-amber-400/35">
                      {t('social.graineTAttend')}
                    </span>
                  )}
                </div>

                {profilePreviewLoading ? (
                  <p className="text-[10px] text-slate-500 mb-2 animate-pulse">{t('common.loading')}</p>
                ) : (
                  <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 p-2 mb-2.5 space-y-1.5">
                    {activityLabel && (
                      <p className="text-[10px] text-slate-400">
                        {t('prairie.profileActivity')}: <span className="text-slate-300">{activityLabel}</span>
                      </p>
                    )}
                    {topPetals.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[9px] uppercase tracking-wide text-slate-500">{t('prairie.profileTopPetals')}</p>
                        {topPetals.map((p) => (
                          <div key={p.id} className="flex items-center gap-1.5">
                            <span className="text-[9px] text-slate-400 w-14 truncate">{p.name}</span>
                            <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${Math.round(p.value * 100)}%`, backgroundColor: p.color }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {social && (
                      <p className="text-[10px] text-slate-400">
                        💧 {social.rosee_received_total ?? 0}
                        {' · '}
                        🌸 {social.pollen_received_total ?? 0}
                      </p>
                    )}
                  </div>
                )}

                {!showPollen ? (
                  <>
                    <button
                      type="button"
                      onClick={openLisiere}
                      className="w-full mb-2 py-2 rounded-lg bg-cyan-500/15 text-cyan-200 text-[11px] font-medium border border-cyan-400/25 hover:bg-cyan-500/25 transition-colors"
                    >
                      🌿 {t('social.voirLisiere')}
                    </button>
                    {relation === 'accepted' && (
                      <button
                        type="button"
                        onClick={() => router.push(`/clairiere?with=${selectedFleur.user_id}`)}
                        className="w-full mb-2 py-2 rounded-lg bg-violet-500/15 text-violet-200 text-[11px] font-medium border border-violet-400/25 hover:bg-violet-500/25 transition-colors"
                      >
                        💬 {t('social.ouvrirClairiere')}
                      </button>
                    )}
                    <div className="flex gap-1.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleArroser(selectedFleur) }}
                        disabled={pointsDeRosee < 1 || arrosing}
                        className="flex-1 px-2 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-[11px] border border-emerald-500/20"
                      >
                        💧 {t('prairie.arroser')}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowPollen(true) }}
                        className="flex-1 px-2 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 text-[11px] border border-amber-500/20"
                      >
                        🌸 {t('prairie.envoyerPollen')}
                      </button>
                    </div>
                    <div className="flex gap-1.5 mt-1.5">
                    <button
                      type="button"
                      onClick={() => router.push(`/jardin/duo?invite_user_id=${selectedFleur.user_id}&invite_pseudo=${encodeURIComponent(selectedFleur.pseudo || '')}`)}
                      className="flex-1 px-2 py-1 rounded-lg bg-slate-800/80 text-violet-300 text-[10px] border border-slate-600/40"
                    >
                      💕 {t('prairie.inviteDuo')}
                    </button>
                    <button
                      type="button"
                      onClick={() => dismissProfilePanel()}
                      className="px-2 py-1 rounded-lg text-slate-500 text-[10px] border border-slate-700/50 hover:text-slate-300"
                      aria-label={t('common.close')}
                    >
                      ✕
                    </button>
                    </div>
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
                                onClick={(e) => { e.stopPropagation(); handlePollen(selectedFleur, card) }}
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
                      onClick={(e) => { e.stopPropagation(); setShowPollen(false) }}
                      className="mt-1.5 text-[10px] text-slate-500 hover:text-slate-700"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                )}
              </motion.div>
              )
            })()}
          </AnimatePresence>
          </div>
      </div>
    </div>
  )
}
