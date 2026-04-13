// @ts-nocheck
'use client'

import { useMemo, useRef, useEffect, useLayoutEffect, useCallback, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { forceCollide, forceLink, forceManyBody, forceCenter, forceRadial, forceX, forceY } from 'd3-force-3d'
import { scoresToPetals } from '@/components/FlowerSVG'
import { PETAL_DEFS, PETAL_BY_ID } from '@/lib/petal-theme'

const PETALS = PETAL_DEFS.map((p) => ({ id: p.id, angle: p.angle, color: p.color }))

const MIN_LEN = 4
const MAX_LEN = 14
const PETAL_W = 3
const NODE_R = 18
const FLOW_PARTICLES = 260
const PETAL_ORDER = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros']
const PETAL_ANGLE = PETAL_DEFS.reduce((acc, p) => {
  acc[p.id] = p.angle
  return acc
}, {})
const PETAL_VECTOR_ANGLE = PETAL_ORDER.reduce((acc, petal, idx) => {
  // Aligné avec la couronne astrolabe: départ en haut, sens horaire.
  acc[petal] = -Math.PI / 2 + (idx / PETAL_ORDER.length) * Math.PI * 2
  return acc
}, {})

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

function dominantPetalId(scores) {
  let best = PETAL_ORDER[0]
  let bestValue = -Infinity
  for (const p of PETAL_ORDER) {
    const v = Number(scores?.[p] ?? 0)
    if (v > bestValue) {
      bestValue = v
      best = p
    }
  }
  return best
}

function profileVector(scores) {
  let vx = 0
  let vy = 0
  let total = 0
  for (const petal of PETAL_ORDER) {
    const raw = Number(scores?.[petal] ?? 0)
    const w = Math.max(0, Math.min(3, raw)) / 3
    const a = PETAL_VECTOR_ANGLE[petal]
    vx += Math.cos(a) * w
    vy += Math.sin(a) * w
    total += w
  }
  const magnitude = Math.hypot(vx, vy)
  const normalizedMagnitude = total > 0 ? Math.min(1, magnitude / total * 2.3) : 0
  return {
    angle: magnitude > 0 ? Math.atan2(vy, vx) : -Math.PI / 2,
    coherence: normalizedMagnitude,
  }
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
  const meNodeIdRef = useRef<string | null>(null)
  const flowRef = useRef(
    Array.from({ length: FLOW_PARTICLES }).map((_, idx) => ({
      phase: (idx / FLOW_PARTICLES) * Math.PI * 2,
      speed: 0.00065 + ((idx * 13) % 9) * 0.00012,
      linkIndex: idx,
      radius: idx % 3 === 0 ? 1.35 : idx % 2 === 0 ? 1.05 : 0.82,
    }))
  )

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
    const myId = String(meId ?? '')
    const contactSet = new Set()
    rawLinks.forEach((l) => {
      const a = String(l.user_a ?? '')
      const b = String(l.user_b ?? '')
      if (!a || !b) return
      if (a === myId) contactSet.add(b)
      else if (b === myId) contactSet.add(a)
    })

    rawNodes.forEach((f) => {
      const id = String(f.user_id ?? f.id ?? Math.random())
      if (nodeMap.has(id)) return
      const dominantPetal = dominantPetalId(f?.scores)
      const petalAngle = PETAL_ANGLE[dominantPetal] ?? 0
      const vector = profileVector(f?.scores)
      const isMeNode = id === myId || !!f.is_me
      const node = {
        ...f,
        id,
        val: 1,
        dominantPetal,
        petalAngle,
        profileAngle: vector.angle,
        profileCoherence: vector.coherence,
        isMe: isMeNode,
        isContact: id !== myId && contactSet.has(id),
      }
      if (isMeNode) meNodeIdRef.current = id
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
  }, [rawNodes, rawLinks, meId])

  const drawFlowerOnCanvas = useCallback(
    (ctx, screenX, screenY, node) => {
      try {
        const petalsData = scoresToPetals(node.scores ?? {})
        const isMe = node.user_id === meId || node.is_me
        const isSelected = selectedUserId != null && Number(node.user_id) === Number(selectedUserId)
        const isHovered = hoveredId != null && String(node.id) === String(hoveredId)
        const scale = 1.35 * (isMe ? 1.6 : 1) * (isSelected ? 1.12 : 1) * (isHovered ? 1.08 : 1)
        const baseAlpha = isSelected ? 1 : isHovered ? 0.95 : 0.82
        const halo = isMe ? 28 : isSelected ? 22 : isHovered ? 15 : 10

        ctx.save()
        ctx.translate(screenX, screenY)
        ctx.scale(scale, scale)

        // Halo (depth / focus)
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        ctx.shadowColor = isMe
          ? 'rgba(251, 191, 36, 0.40)'
          : isSelected
            ? 'rgba(255, 42, 166, 0.44)'
            : 'rgba(34, 211, 238, 0.28)'
        ctx.shadowBlur = halo + 2
        ctx.beginPath()
        ctx.arc(0, 0, isMe ? 14 : 10, 0, 2 * Math.PI)
        ctx.fillStyle = 'rgba(255,255,255,0.05)'
        ctx.fill()
        ctx.restore()

        PETALS.forEach((p) => {
          const intensity = Math.max(0.2, Math.min(1, petalsData[p.id] ?? 0.3))
          const halfLen = (isMe ? 1.22 : 1) * (MIN_LEN + intensity * (MAX_LEN - MIN_LEN))
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
          ctx.lineWidth = isMe ? 1.4 : 0.6
          ctx.stroke()
          ctx.restore()
        })

        ctx.beginPath()
        ctx.arc(0, 0, isMe ? 8.2 : 5, 0, 2 * Math.PI)
        ctx.fillStyle = isMe ? '#fff5c7' : '#ffffff'
        ctx.fill()
        ctx.strokeStyle = isMe ? '#f59e0b' : '#22d3ee'
        ctx.lineWidth = isMe ? 1.3 : 0.9
        ctx.stroke()

        // Presence dot (if available)
        const isOnline = !!(node?.presence?.is_online ?? node?.is_online)
        if (isOnline) {
          ctx.beginPath()
          ctx.arc(isMe ? 13 : 9, isMe ? -11 : -8, isMe ? 2.8 : 2.3, 0, 2 * Math.PI)
          ctx.fillStyle = 'rgba(34,197,94,0.95)'
          ctx.fill()
          ctx.strokeStyle = 'rgba(0,0,0,0.45)'
          ctx.lineWidth = 0.7
          ctx.stroke()
        }

        // Engraved-like label (no floating pill)
        const label = `${node.pseudo ?? ''} ${node.avatar_emoji ?? '🌸'}`.trim() || 'Fleur'
        ctx.restore()
        ctx.save()
        ctx.translate(screenX, screenY + 23)
        const angleDeg = ((hash01(String(node.id)) * 120) - 60) * (Math.PI / 180)
        ctx.rotate(angleDeg * 0.09)
        ctx.font = `${isSelected ? 12 : 11}px ui-serif, Georgia, Times New Roman, serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.shadowBlur = isSelected ? 8 : 5
        ctx.shadowColor = isSelected ? 'rgba(253,224,71,0.45)' : 'rgba(217,119,6,0.35)'
        ctx.fillStyle = isSelected ? 'rgba(254,240,138,0.95)' : 'rgba(252,211,77,0.86)'
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

    const now = performance.now()
    if (links.length > 0) {
      const particles = flowRef.current
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        const link = links[(p.linkIndex + i) % links.length]
        if (!link) continue
        const src = typeof link.source === 'object' ? link.source : nodes.find((n) => String(n.id) === String(link.source))
        const tgt = typeof link.target === 'object' ? link.target : nodes.find((n) => String(n.id) === String(link.target))
        if (!src || !tgt) continue
        const sx = src.x
        const sy = src.y
        const tx = tgt.x
        const ty = tgt.y
        if (![sx, sy, tx, ty].every(Number.isFinite)) continue
        const t = (Math.sin(p.phase + now * p.speed) + 1) / 2
        const gx = sx + (tx - sx) * t
        const gy = sy + (ty - sy) * t
        const screen = g.graph2ScreenCoords(gx, gy)
        const alpha = 0.28 + t * 0.52

        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        ctx.shadowBlur = 8
        ctx.shadowColor = 'rgba(34,211,238,0.55)'
        ctx.fillStyle = `rgba(74,222,128,${alpha.toFixed(3)})`
        ctx.beginPath()
        ctx.arc(screen.x, screen.y, p.radius, 0, 2 * Math.PI)
        ctx.fill()
        ctx.restore()
      }
    }
  }, [nodes, links, w, h, drawFlowerOnCanvas])

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

  useEffect(() => {
    const g = fgRef.current
    if (!g || !nodes.length) return
    // Le système de coordonnées de force-graph est non-translaté :
    // graph2ScreenCoords(x,y) = x*k + t.x — (0,0) = coin supérieur-gauche du canvas.
    // On centre les forces sur (w/2, h/2) pour attirer les nœuds au milieu.
    const cx = w / 2
    const cy = h / 2
    // Spawn doux: toutes les fleurs naissent pres du centre,
    // puis la physique les ecarte vers leur position statistique.
    nodes.forEach((n, idx) => {
      const spawnAngle = (idx / Math.max(1, nodes.length)) * Math.PI * 2
      const spawnRadius = n?.isMe ? 0 : 16 + (hash01(String(n?.id)) * 18)
      if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) {
        n.x = cx + Math.cos(spawnAngle) * spawnRadius
        n.y = cy + Math.sin(spawnAngle) * spawnRadius
      }
      n.vx = 0
      n.vy = 0
    })
    nodes.forEach((n) => {
      if (n?.isMe) {
        n.fx = cx
        n.fy = cy
      } else {
        if ('fx' in n) delete n.fx
        if ('fy' in n) delete n.fy
      }
    })
    g.d3Force('link', forceLink()
      .id((d) => d.id)
      .distance((link) => {
        const s = Math.max(0, Math.min(1, link.strength ?? 0.5))
        return 184 - s * 92
      })
      .strength((link) => {
        const s = Math.max(0, Math.min(1, link.strength ?? 0.5))
        return 0.08 + s * 0.22
      })
    )
    // distanceMax évite que les nœuds sans liens (ex. isolés) soient repoussés à l'infini
    g.d3Force('charge', forceManyBody().strength(-230).distanceMax(360))
    // Attraction centrale plus douce pour eviter l'effet "amas" au milieu.
    g.d3Force('center', forceCenter(cx, cy).strength(0.07))
    // Anneau doux autour du centre du canvas
    g.d3Force('radial', forceRadial(Math.min(w, h) * 0.276, cx, cy).strength(0.03))
    // Positionner les contacts sur le pétale dominant de leur fleur.
    const contactRing = Math.min(w, h) * 0.46
    g.d3Force(
      'petalX',
      forceX((d) => {
        if (d?.isMe) return cx
        if (!d?.isContact) return cx
        const a = d?.profileAngle ?? -Math.PI / 2
        const radial = contactRing * (0.84 + (d?.profileCoherence ?? 0) * 0.55)
        return cx + Math.cos(a) * radial
      }).strength((d) => (d?.isMe ? 0.3 : d?.isContact ? 0.22 : 0.04))
    )
    g.d3Force(
      'petalY',
      forceY((d) => {
        if (d?.isMe) return cy
        if (!d?.isContact) return cy
        const a = d?.profileAngle ?? -Math.PI / 2
        const radial = contactRing * (0.84 + (d?.profileCoherence ?? 0) * 0.55)
        return cy + Math.sin(a) * radial
      }).strength((d) => (d?.isMe ? 0.3 : d?.isContact ? 0.22 : 0.04))
    )
    g.d3Force(
      'collide',
      forceCollide((d) => {
        if (d?.isMe) return NODE_R + 34
        if (d?.isContact) return NODE_R + 10
        return NODE_R + 8
      }).strength(1)
    )
    g.d3ReheatSimulation()
    // Verrouiller la caméra sur le centre du graphe (cohérent avec "moi" au centre).
    g.centerAt(cx, cy, 0)
    g.zoom(1, 0)
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
            return `rgba(90,${g},${b},${alpha})`
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
            ctx.strokeStyle = focused ? `rgba(255,43,166,${0.12 + s * 0.20})` : `rgba(34,211,238,${0.08 + s * 0.16})`
            ctx.lineWidth = (focused ? 2.0 : 1.2) + s * 1.4
            ctx.shadowBlur = focused ? 12 : 8
            ctx.shadowColor = focused ? 'rgba(255,43,166,0.45)' : 'rgba(34,211,238,0.38)'
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
        enableNodeDrag={false}
        enablePanInteraction={false}
        enableZoomInteraction={false}
        d3AlphaDecay={0.04}
        d3VelocityDecay={0.42}
        cooldownTicks={100}
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
