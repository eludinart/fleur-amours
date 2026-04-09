// @ts-nocheck
'use client'

import { useMemo, useRef, useEffect, useLayoutEffect, useCallback, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { forceCollide, forceLink, forceManyBody, forceCenter, forceRadial } from 'd3-force-3d'
import { scoresToPetals } from '@/components/FlowerSVG'
import { PETAL_DEFS, PETAL_BY_ID } from '@/lib/petal-theme'

const PETALS = PETAL_DEFS.map((p) => ({ id: p.id, angle: p.angle, color: p.color }))

const MIN_LEN = 4
const MAX_LEN = 14
const PETAL_W = 3
const NODE_R = 18

function hash01(str) {
  const s = String(str ?? '')
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}

function resonance(scoresA, scoresB) {
  if (!scoresA || !scoresB) return 0
  let sum = 0
  let n = 0
  for (const p of ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros']) {
    const a = (scoresA[p] ?? 0) / 3
    const b = (scoresB[p] ?? 0) / 3
    sum += 1 - Math.min(1, Math.abs(a - b))
    n++
  }
  return n > 0 ? sum / n : 0
}

export function GrandJardinGalaxie({
  nodes: rawNodes = [],
  links: rawLinks = [],
  meId,
  selectedUserId,
  onNodeClick,
  onBackgroundClick,
}) {
  const fgRef = useRef(null)
  const overlayRef = useRef(null)
  const wrapperRef = useRef(null)
  const [hoveredId, setHoveredId] = useState(null)
  // Auto-mesure : le composant observe sa propre taille pour piloter le canvas.
  // useLayoutEffect = lecture SYNCHRONE avant le premier paint → plus de flash 800×600.
  const [dims, setDims] = useState({ w: 800, h: 600 })
  const w = dims.w
  const h = dims.h
  const paintRafRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const { offsetWidth, offsetHeight } = el
    if (offsetWidth > 0 && offsetHeight > 0) setDims({ w: offsetWidth, h: offsetHeight })
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? {}
      if (width > 0 && height > 0) setDims({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { nodes, links } = useMemo(() => {
    const nodeMap = new Map()
    const list = []
    rawNodes.forEach((f) => {
      const id = String(f.user_id ?? f.id ?? Math.random())
      if (nodeMap.has(id)) return
      const node = { ...f, id, val: 1 }
      nodeMap.set(id, node)
      list.push(node)
    })

    const linkSet = new Set()
    const linkList = []
    rawLinks.forEach((l) => {
      const a = String(l.user_a)
      const b = String(l.user_b)
      if (nodeMap.has(a) && nodeMap.has(b) && a !== b) {
        const key = a < b ? `${a}-${b}` : `${b}-${a}`
        if (!linkSet.has(key)) {
          linkSet.add(key)
          linkList.push({ source: a, target: b, strength: 1, curvature: 0 })
        }
      }
    })

    const RESONANCE_THRESHOLD = 0.5
    const RESONANCE_STRENGTH = 0.4
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]
        const b = list[j]
        const key = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`
        if (linkSet.has(key)) continue
        const r = resonance(a.scores, b.scores)
        if (r >= RESONANCE_THRESHOLD) {
          linkSet.add(key)
          linkList.push({ source: a.id, target: b.id, strength: r * RESONANCE_STRENGTH, curvature: 0 })
        }
      }
    }
    return { nodes: list, links: linkList }
  }, [rawNodes, rawLinks])

  const drawFlowerOnCanvas = useCallback(
    (ctx, screenX, screenY, node) => {
      try {
        const petalsData = scoresToPetals(node.scores ?? {})
        const isMe = node.user_id === meId || node.is_me
        const isSelected = selectedUserId != null && Number(node.user_id) === Number(selectedUserId)
        const isHovered = hoveredId != null && String(node.id) === String(hoveredId)
        const scale = 1.35 * (isMe ? 1.15 : 1) * (isSelected ? 1.12 : 1) * (isHovered ? 1.08 : 1)
        const baseAlpha = isSelected ? 1 : isHovered ? 0.95 : 0.82
        const halo = isSelected ? 20 : isHovered ? 14 : 9

        ctx.save()
        ctx.translate(screenX, screenY)
        ctx.scale(scale, scale)

        // Halo (depth / focus)
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        ctx.shadowColor = isMe
          ? 'rgba(251, 191, 36, 0.35)'
          : isSelected
            ? 'rgba(139, 92, 246, 0.35)'
            : 'rgba(16, 185, 129, 0.22)'
        ctx.shadowBlur = halo
        ctx.beginPath()
        ctx.arc(0, 0, isMe ? 11 : 10, 0, 2 * Math.PI)
        ctx.fillStyle = 'rgba(255,255,255,0.04)'
        ctx.fill()
        ctx.restore()

        PETALS.forEach((p) => {
          const intensity = Math.max(0.2, Math.min(1, petalsData[p.id] ?? 0.3))
          const halfLen = MIN_LEN + intensity * (MAX_LEN - MIN_LEN)
          const tip = halfLen * 2
          const pw = PETAL_W
          ctx.save()
          ctx.rotate((p.angle * Math.PI) / 180)
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.bezierCurveTo(-pw * 1.1, -halfLen * 0.4, -pw * 0.8, -tip * 0.7, 0, -tip)
          ctx.bezierCurveTo(pw * 0.8, -tip * 0.7, pw * 1.1, -halfLen * 0.4, 0, 0)
          ctx.closePath()
          ctx.fillStyle = p.color
          ctx.globalAlpha = baseAlpha * (0.55 + intensity * 0.45)
          ctx.fill()
          ctx.strokeStyle = p.color
          ctx.lineWidth = isMe ? 1.2 : 0.6
          ctx.stroke()
          ctx.restore()
        })

        ctx.beginPath()
        ctx.arc(0, 0, isMe ? 6 : 5, 0, 2 * Math.PI)
        ctx.fillStyle = isMe ? '#fef3c7' : '#fda4af'
        ctx.fill()
        ctx.strokeStyle = isMe ? '#d97706' : PETAL_BY_ID.agape.color
        ctx.lineWidth = isMe ? 1.2 : 0.8
        ctx.stroke()

        // Presence dot (if available)
        const isOnline = !!(node?.presence?.is_online ?? node?.is_online)
        if (isOnline) {
          ctx.beginPath()
          ctx.arc(9, -8, 2.3, 0, 2 * Math.PI)
          ctx.fillStyle = 'rgba(34,197,94,0.95)'
          ctx.fill()
          ctx.strokeStyle = 'rgba(0,0,0,0.45)'
          ctx.lineWidth = 0.7
          ctx.stroke()
        }

        // Label pill under the flower
        const label = `${node.pseudo ?? ''} ${node.avatar_emoji ?? '🌸'}`.trim() || 'Fleur'
        ctx.restore()
        ctx.save()
        ctx.translate(screenX, screenY + 22)
        ctx.font = `${isSelected ? 12 : 11}px system-ui, -apple-system, Segoe UI, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const metrics = ctx.measureText(label)
        const padX = 7
        const pillW = Math.max(26, metrics.width + padX * 2)
        const pillH = 18 + (isSelected ? 1 : 0)
        const r = 9
        ctx.beginPath()
        ctx.moveTo(-pillW / 2 + r, -pillH / 2)
        ctx.arcTo(pillW / 2, -pillH / 2, pillW / 2, pillH / 2, r)
        ctx.arcTo(pillW / 2, pillH / 2, -pillW / 2, pillH / 2, r)
        ctx.arcTo(-pillW / 2, pillH / 2, -pillW / 2, -pillH / 2, r)
        ctx.arcTo(-pillW / 2, -pillH / 2, pillW / 2, -pillH / 2, r)
        ctx.closePath()
        ctx.fillStyle = isSelected
          ? 'rgba(17, 24, 39, 0.72)'
          : isHovered
            ? 'rgba(15, 23, 42, 0.62)'
            : 'rgba(2, 6, 23, 0.52)'
        ctx.fill()
        ctx.strokeStyle = isSelected ? 'rgba(167, 139, 250, 0.55)' : 'rgba(255,255,255,0.12)'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.fillStyle = 'rgba(255,255,255,0.92)'
        ctx.fillText(label, 0, 0)
        ctx.restore()
      } catch {
        // Keep render resilient: a single bad node should not break the whole overlay
        try { ctx.restore() } catch {}
      }
    },
    [meId, selectedUserId, hoveredId]
  )

  const paintOverlay = useCallback(() => {
    const g = fgRef.current
    const canvas = overlayRef.current
    if (!g || !canvas || !nodes.length) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    ctx.clearRect(0, 0, w, h)

    nodes.forEach((node) => {
      const gx = node.x
      const gy = node.y
      if (gx == null || gy == null || !Number.isFinite(gx) || !Number.isFinite(gy)) return
      const { x: sx, y: sy } = g.graph2ScreenCoords(gx, gy)
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) return
      drawFlowerOnCanvas(ctx, sx, sy, node)
    })
  }, [nodes, w, h, drawFlowerOnCanvas])

  const scheduleOverlayPaint = useCallback(() => {
    if (paintRafRef.current != null) return
    paintRafRef.current = window.requestAnimationFrame(() => {
      paintRafRef.current = null
      paintOverlay()
    })
  }, [paintOverlay])

  useEffect(() => {
    // Nettoyage RAF (unmount)
    return () => {
      if (paintRafRef.current != null) {
        try {
          window.cancelAnimationFrame(paintRafRef.current)
        } catch {}
      }
      paintRafRef.current = null
    }
  }, [])

  // Couleur = __indexColor sur le canvas d’ombre uniquement (picking) — pas affiché à l’écran
  const paintPointerArea = useCallback((node, color, ctx) => {
    const x = node.x ?? 0
    const y = node.y ?? 0
    ctx.beginPath()
    ctx.arc(x, y, NODE_R + 10, 0, 2 * Math.PI)
    ctx.fillStyle = color
    ctx.fill()
  }, [])

  const graphData = useMemo(() => ({ nodes, links }), [nodes, links])

  const zoomFitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const g = fgRef.current
    if (!g || !nodes.length) return
    // Le système de coordonnées de force-graph est non-translaté :
    // graph2ScreenCoords(x,y) = x*k + t.x — (0,0) = coin supérieur-gauche du canvas.
    // On centre les forces sur (w/2, h/2) pour attirer les nœuds au milieu.
    const cx = w / 2
    const cy = h / 2
    g.d3Force('link', forceLink()
      .id((d) => d.id)
      .distance((link) => Math.max(40, 120 - (link.strength ?? 0.5) * 100))
      .strength((link) => Math.min(0.8, (link.strength ?? 0.5) * 0.7))
    )
    // distanceMax évite que les nœuds sans liens (ex. isolés) soient repoussés à l'infini
    g.d3Force('charge', forceManyBody().strength(-160).distanceMax(280))
    // Strength 0.3 pour une attraction centrale plus marquée (évite la dérive des isolés)
    g.d3Force('center', forceCenter(cx, cy).strength(0.3))
    // Anneau doux autour du centre du canvas
    g.d3Force('radial', forceRadial(Math.min(w, h) * 0.15, cx, cy).strength(0.08))
    g.d3Force('collide', forceCollide(NODE_R + 4))
    g.d3ReheatSimulation()

    // Centrer + cadrer la vue pendant la simulation (ne pas attendre onEngineStop)
    if (zoomFitTimerRef.current) clearTimeout(zoomFitTimerRef.current)
    zoomFitTimerRef.current = setTimeout(() => {
      fgRef.current?.zoomToFit(300, 64)
    }, 900)

    return () => {
      if (zoomFitTimerRef.current) clearTimeout(zoomFitTimerRef.current)
    }
  }, [nodes, links, w, h])

  useEffect(() => {
    // Première peinture + quand la data change
    scheduleOverlayPaint()
  }, [scheduleOverlayPaint, nodes, links, w, h, meId, selectedUserId, hoveredId])

  if (!nodes.length) {
    return null
  }

  return (
    <div ref={wrapperRef} className="absolute inset-0 w-full h-full" style={{ overflow: 'hidden' }}>
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        width={w}
        height={h}
        nodeId="id"
        nodeColor="rgba(0,0,0,0)"
        nodeVal={0.5}
        /* Sans ça, force-graph dessine toujours un disque plein (fallback bleu D3 rgba(31,120,180)) */
        nodeCanvasObjectMode={() => 'replace'}
        nodeCanvasObject={() => {
          /* Fleurs = overlay canvas ; canvas principal = liens seulement */
        }}
        onEngineTick={scheduleOverlayPaint}
        onEngineStop={() => {
          scheduleOverlayPaint()
          fgRef.current?.zoomToFit(200, 48)
        }}
        onZoom={scheduleOverlayPaint}
        nodePointerAreaPaint={paintPointerArea}
        nodeLabel={(n) => `${n.pseudo ?? ''} ${n.avatar_emoji ?? '🌸'}`.trim() || 'Fleur'}
        linkVisibility={(l) => (l.strength ?? 0) >= 0.3}
        linkWidth={(l) => {
          const s = Math.max(0, Math.min(1, l?.strength ?? 0.5))
          return 0.45 + s * 0.65
        }}
        linkCurvature={0}
        linkColor={(l) => {
          try {
            const s = Math.max(0, Math.min(1, l?.strength ?? 0.5))
            const a = 0.05 + s * 0.22
            const focused =
              hoveredId != null
                ? String(l.source?.id ?? l.source) === String(hoveredId) || String(l.target?.id ?? l.target) === String(hoveredId)
                : selectedUserId != null
                  ? String(l.source?.id ?? l.source) === String(selectedUserId) || String(l.target?.id ?? l.target) === String(selectedUserId)
                  : false
            const alpha = focused ? Math.min(0.55, a + 0.2) : a
            const g = Math.floor(180 + s * 60)
            const b = Math.floor(190 + s * 40)
            return `rgba(120,${g},${b},${alpha})`
          } catch {
            return 'rgba(134,239,172,0.35)'
          }
        }}
        // Glow discret sur les liens (canvas custom) pour éviter l'effet "barres violettes"
        linkCanvasObjectMode={() => 'after'}
        linkCanvasObject={(link, ctx) => {
          try {
            const src = link.source
            const tgt = link.target
            const x1 = src?.x ?? 0
            const y1 = src?.y ?? 0
            const x2 = tgt?.x ?? 0
            const y2 = tgt?.y ?? 0
            const s = Math.max(0, Math.min(1, link?.strength ?? 0.5))
            const focused =
              hoveredId != null
                ? String(src?.id ?? link.source) === String(hoveredId) || String(tgt?.id ?? link.target) === String(hoveredId)
                : selectedUserId != null
                  ? String(src?.id ?? link.source) === String(selectedUserId) || String(tgt?.id ?? link.target) === String(selectedUserId)
                  : false

            ctx.save()
            ctx.globalCompositeOperation = 'lighter'
            ctx.strokeStyle = focused ? `rgba(167,139,250,${0.12 + s * 0.18})` : `rgba(52,211,153,${0.06 + s * 0.14})`
            ctx.lineWidth = (focused ? 2.0 : 1.2) + s * 1.4
            ctx.shadowBlur = focused ? 10 : 6
            ctx.shadowColor = focused ? 'rgba(167,139,250,0.45)' : 'rgba(52,211,153,0.35)'
            ctx.beginPath()
            ctx.moveTo(x1, y1)
            ctx.lineTo(x2, y2)
            ctx.stroke()
            ctx.restore()
          } catch {
            /* ignore */
          }
        }}
        backgroundColor="transparent"
        onNodeClick={(node) => onNodeClick?.(node)}
        onBackgroundClick={() => onBackgroundClick?.()}
        onNodeHover={(node) => {
          setHoveredId(node ? String(node.id) : null)
          scheduleOverlayPaint()
        }}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.35}
        cooldownTicks={180}
      />
      <canvas
        ref={overlayRef}
        width={w}
        height={h}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          width: w,
          height: h,
        }}
        aria-hidden
      />
    </div>
  )
}
