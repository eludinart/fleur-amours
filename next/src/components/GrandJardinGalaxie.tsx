// @ts-nocheck — fichier volumineux, galaxie Grand Jardin
'use client'

import {
  useMemo,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { forceLink } from 'd3-force-3d'
import { scoresToPetals } from '@/components/FlowerSVG'
import { PETAL_DEFS, PETAL_BY_ID } from '@/lib/petal-theme'
import {
  loadGalaxieView,
  saveGalaxieView,
  resonanceBetween,
  complementarityBetween,
  BOUSSOLE_MIRROR_THRESHOLD,
  BOUSSOLE_COMPLEMENT_THRESHOLD,
} from '@/lib/grand-jardin-view'
import { GalaxieLegend } from '@/components/galaxie/GalaxieLegend'
import { GalaxieMinimap } from '@/components/galaxie/GalaxieMinimap'
import { GalaxieTooltip } from '@/components/galaxie/GalaxieTooltip'

const PETALS = PETAL_DEFS.map((p) => ({ id: p.id, angle: p.angle, color: p.color }))
const NODE_R = 22
const FLOW_PARTICLES = 48
const RESONANCE_THRESHOLD = 0.42
const RESONANCE_STRENGTH = 0.4
const NEIGHBORHOOD_RESONANCE = 0.55
const PETAL_ORDER = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros']
const PETAL_ANGLE = PETAL_DEFS.reduce((acc, p) => { acc[p.id] = p.angle; return acc }, {})
const PETAL_VECTOR_ANGLE = PETAL_ORDER.reduce((acc, petal, idx) => {
  acc[petal] = -Math.PI / 2 + (idx / PETAL_ORDER.length) * Math.PI * 2
  return acc
}, {})
const MIN_ZOOM = 0.45
const MAX_ZOOM = 2.8
const MAX_LABEL_CHARS = 16
const SAVE_VIEW_DEBOUNCE_MS = 400

function hash01(str) {
  const s = String(str ?? '')
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 10000) / 10000
}

function dominantPetalId(scores) {
  let best = PETAL_ORDER[0]
  let bestValue = -Infinity
  for (const p of PETAL_ORDER) {
    const v = Number(scores?.[p] ?? 0)
    if (v > bestValue) { bestValue = v; best = p }
  }
  return best
}

function nodeImportance(node) {
  if (node?.isMe) return 1.6
  let imp = 0.85
  if (node?.isContact) imp += 0.22
  if (node?.presence?.is_online ?? node?.is_online) imp += 0.12
  imp += Math.min(0.18, (node?.resonanceWithMe ?? 0) * 0.2)
  return imp
}

function nodeCollisionRadius(node) {
  return (NODE_R + (node?.isMe ? 38 : node?.isContact ? 22 : 16)) * nodeImportance(node)
}

function minGapBetween(a, b, minDim) {
  return Math.max(58, minDim * 0.058) + (nodeCollisionRadius(a) + nodeCollisionRadius(b)) * 0.5
}

function relationshipRing(node) {
  if (node?.isContact) return 1
  const r = node?.resonanceWithMe ?? 0
  if (r >= NEIGHBORHOOD_RESONANCE) return 2
  if (r >= 0.38) return 3
  return 4
}

const RING_RADIUS_FRAC = { 1: 0.50, 2: 0.66, 3: 0.82, 4: 1.0 }

function outerLayoutRadius(minDim, othersCount, neighborhoodMode) {
  const base = neighborhoodMode ? 0.26 : 0.32
  const countBoost = Math.min(0.12, Math.sqrt(Math.max(0, othersCount - 4)) * 0.026)
  return minDim * (base + countBoost)
}

function computeFitZoom(nodes, me, viewW, viewH, labelPad = 58) {
  if (!me || !Number.isFinite(me.x) || viewW <= 0 || viewH <= 0) return 1
  let maxR = 96
  for (const node of nodes) {
    if (node.isMe) continue
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) continue
    const d = Math.hypot(node.x - me.x, node.y - me.y) + nodeCollisionRadius(node) + labelPad
    maxR = Math.max(maxR, d)
  }
  const fitK = Math.min(viewW / (2 * maxR), viewH / (2 * maxR)) * 0.91
  return Math.max(MIN_ZOOM, Math.min(1.15, fitK))
}

function layoutConstellation(nodeList, cx, cy, minDim, neighborhoodMode) {
  const me = nodeList.find((n) => n?.isMe)
  if (me) { me.x = cx; me.y = cy }

  const others = nodeList.filter((n) => !n?.isMe)
  if (!others.length) return

  const outerR = outerLayoutRadius(minDim, others.length, neighborhoodMode)
  const maxDist = outerR + minDim * 0.055
  const sectorSpan = (Math.PI * 2) / PETAL_ORDER.length

  const byRing = new Map([[1, []], [2, []], [3, []], [4, []]])
  for (const node of others) {
    byRing.get(relationshipRing(node)).push(node)
  }

  for (const ring of [1, 2, 3, 4]) {
    const ringNodes = (byRing.get(ring) ?? [])
      .slice()
      .sort((a, b) => {
        const pa = PETAL_ORDER.indexOf(a.dominantPetal ?? PETAL_ORDER[0])
        const pb = PETAL_ORDER.indexOf(b.dominantPetal ?? PETAL_ORDER[0])
        if (pa !== pb) return pa - pb
        return (b.resonanceWithMe ?? 0) - (a.resonanceWithMe ?? 0) || String(a.id).localeCompare(String(b.id))
      })
    const n = ringNodes.length
    if (!n) continue

    const baseR = outerR * (RING_RADIUS_FRAC[ring] ?? 1)
    const angleStep = (Math.PI * 2) / n
    const ringPhase = (ring - 1) * 0.36 + hash01(`ring-phase-${ring}`) * 0.1

    ringNodes.forEach((node, i) => {
      const petalIdx = Math.max(0, PETAL_ORDER.indexOf(node.dominantPetal ?? PETAL_ORDER[0]))
      const sectorCenter = -Math.PI / 2 + petalIdx * sectorSpan
      const evenAngle = -Math.PI / 2 + ringPhase + i * angleStep
      const petalBias = ring === 1 ? 0.4 : ring === 2 ? 0.26 : 0.12
      const angle = evenAngle * (1 - petalBias) + sectorCenter * petalBias + (hash01(node.id) - 0.5) * 0.05

      const resPull = ring <= 2 ? (1 - (node.resonanceWithMe ?? 0.4)) * 0.028 * minDim : 0
      let r = baseR - resPull + (hash01(`${node.id}-r`) - 0.5) * 5
      if (ring === 1 && node.isContact) r *= 0.9

      const x = cx + Math.cos(angle) * r
      const y = cy + Math.sin(angle) * r
      node._layoutAnchor = { x, y }
      node.x = x
      node.y = y
    })
  }

  const meClear = Math.max(74, minDim * 0.082)
  const iterations = 32

  for (let iter = 0; iter < iterations; iter++) {
    if (me && Number.isFinite(me.x)) {
      for (const node of others) {
        const dx = node.x - me.x
        const dy = node.y - me.y
        const dist = Math.hypot(dx, dy) || 0.01
        const need = Math.max(minGapBetween(me, node, minDim), meClear)
        if (dist < need) {
          const push = (need - dist) * 0.82
          node.x += (dx / dist) * push
          node.y += (dy / dist) * push
        }
      }
    }

    for (let i = 0; i < others.length; i++) {
      for (let j = i + 1; j < others.length; j++) {
        const a = others[i]
        const b = others[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.hypot(dx, dy) || 0.01
        const need = minGapBetween(a, b, minDim)
        if (dist < need) {
          const push = (need - dist) * 0.4
          const ux = dx / dist
          const uy = dy / dist
          a.x -= ux * push
          a.y -= uy * push
          b.x += ux * push
          b.y += uy * push
        }
      }
    }

    const pull = 0.2 * (1 - iter / iterations)
    if (pull > 0.008) {
      for (const node of others) {
        const anchor = node._layoutAnchor
        if (!anchor) continue
        node.x += (anchor.x - node.x) * pull
        node.y += (anchor.y - node.y) * pull
      }
    }

    if (me) {
      for (const node of others) {
        const dx = node.x - me.x
        const dy = node.y - me.y
        const dist = Math.hypot(dx, dy) || 0.01
        if (dist > maxDist) {
          node.x = me.x + (dx / dist) * maxDist
          node.y = me.y + (dy / dist) * maxDist
        }
      }
    }
  }

  for (const node of others) delete node._layoutAnchor
}

function linkTouchesMe(link, meNodeId) {
  if (!meNodeId) return false
  const sid = linkEndpointId(link.source)
  const tid = linkEndpointId(link.target)
  return sid === meNodeId || tid === meNodeId
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function nodeMatchesFilter(node, filterMode, petalFilter, searchQuery) {
  if (node?.isMe) return true
  if (petalFilter && node?.dominantPetal !== petalFilter) return false
  if (filterMode === 'contacts' && !node?.isContact) return false
  if (filterMode === 'online' && !(node?.presence?.is_online ?? node?.is_online)) return false
  if (filterMode === 'mirror') {
    return (node?.resonanceWithMe ?? 0) >= BOUSSOLE_MIRROR_THRESHOLD
  }
  if (filterMode === 'complement') {
    return (node?.complementarityWithMe ?? 0) >= BOUSSOLE_COMPLEMENT_THRESHOLD
  }
  if (filterMode === 'neighborhood') {
    if (node?.isContact) return true
    if ((node?.resonanceWithMe ?? 0) >= NEIGHBORHOOD_RESONANCE) return true
    return false
  }
  return true
}

function linkEndpointId(endpoint) { return String(endpoint?.id ?? endpoint ?? '') }

function buildNeighborSet(focusId, links, meNodeId) {
  if (!focusId) return null
  const set = new Set([focusId])
  if (meNodeId) set.add(meNodeId)
  for (const link of links) {
    const sid = linkEndpointId(link.source)
    const tid = linkEndpointId(link.target)
    if (sid === focusId) set.add(tid)
    if (tid === focusId) set.add(sid)
  }
  return set
}

function profileVector(scores) {
  let vx = 0, vy = 0, total = 0
  for (const petal of PETAL_ORDER) {
    const raw = Number(scores?.[petal] ?? 0)
    const w = Math.max(0, Math.min(3, raw)) / 3
    const a = PETAL_VECTOR_ANGLE[petal]
    vx += Math.cos(a) * w; vy += Math.sin(a) * w; total += w
  }
  const magnitude = Math.hypot(vx, vy)
  return {
    angle: magnitude > 0 ? Math.atan2(vy, vx) : -Math.PI / 2,
    coherence: total > 0 ? Math.min(1, magnitude / total * 2.3) : 0,
  }
}

function graphCenterTarget(nodes, fallbackX, fallbackY) {
  const me = nodes.find((n) => n.isMe)
  if (me && Number.isFinite(me.fx)) return { x: me.fx, y: me.fy }
  if (me && Number.isFinite(me.x) && Number.isFinite(me.y)) return { x: me.x, y: me.y }
  let sx = 0, sy = 0, count = 0
  for (const node of nodes) {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) continue
    sx += node.x
    sy += node.y
    count++
  }
  return count > 0 ? { x: sx / count, y: sy / count } : { x: fallbackX, y: fallbackY }
}

function truncateLabel(text, max = MAX_LABEL_CHARS) {
  const s = String(text ?? '').trim()
  if (s.length <= max) return s
  return `${s.slice(0, max - 1)}…`
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function hexToRgb(hex) {
  const h = String(hex ?? '#888').replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16) || 136,
    g: parseInt(h.slice(2, 4), 16) || 136,
    b: parseInt(h.slice(4, 6), 16) || 136,
  }
}

function darkenHex(hex, factor) {
  const { r, g, b } = hexToRgb(hex)
  const f = 1 - factor
  return `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`
}

function lightenHex(hex, factor) {
  const { r, g, b } = hexToRgb(hex)
  return `rgb(${Math.round(r + (255 - r) * factor)},${Math.round(g + (255 - g) * factor)},${Math.round(b + (255 - b) * factor)})`
}

function drawCanvasPetal(ctx, pLen, pW, fillStyle, alpha, ox = 0, oy = 0) {
  const tip = pLen
  const hw = pW * 0.55
  ctx.beginPath()
  ctx.moveTo(ox, oy)
  ctx.bezierCurveTo(ox - hw * 1.05, oy - pLen * 0.22, ox - hw * 0.75, oy - tip * 0.72, ox, oy - tip)
  ctx.bezierCurveTo(ox + hw * 0.75, oy - tip * 0.72, ox + hw * 1.05, oy - pLen * 0.22, ox, oy)
  ctx.closePath()
  ctx.globalAlpha = alpha
  ctx.fillStyle = fillStyle
  ctx.fill()
}

export const GrandJardinGalaxie = forwardRef(function GrandJardinGalaxie({
  nodes: rawNodes = [],
  links: rawLinks = [],
  meId,
  selectedUserId,
  filterMode = 'all',
  petalFilter = '',
  searchQuery = '',
  onNodeClick,
  onBackgroundClick,
  onCameraChange,
}, ref) {
  const fgRef = useRef(null)
  const overlayRef = useRef(null)
  const wrapperRef = useRef(null)
  const lastCameraDimsRef = useRef({ w: 0, h: 0 })
  const lastLayoutKeyRef = useRef('')
  const pendingCameraCenterRef = useRef(false)
  const applyCameraCenterRef = useRef(null)
  const applyGraphLayoutRef = useRef(() => false)
  const cameraRef = useRef({ k: 1, x: 0, y: 0 })
  const saveViewTimerRef = useRef(null)
  const pulseStartRef = useRef(0)
  const [hoveredId, setHoveredId] = useState(null)
  const [hoverScreen, setHoverScreen] = useState(null)
  const [legendCollapsed, setLegendCollapsed] = useState(true)
  const [keyboardIdx, setKeyboardIdx] = useState(-1)
  const [cameraTick, setCameraTick] = useState(0)
  const zoomLevelRef = useRef(1)
  const [dimsMeasured, setDimsMeasured] = useState(false)
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const w = dims.w
  const h = dims.h
  const paintRafRef = useRef(null)
  const meNodeIdRef = useRef(null)
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
    const measure = () => {
      const { offsetWidth, offsetHeight } = el
      if (offsetWidth > 0 && offsetHeight > 0) {
        setDims({ w: offsetWidth, h: offsetHeight })
        setDimsMeasured(true)
      }
    }
    measure()
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? {}
      if (width > 0 && height > 0) {
        setDims({ w: width, h: height })
        setDimsMeasured(true)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const meNodeScores = useMemo(() => {
    const myId = String(meId ?? '')
    const me = rawNodes.find((f) => String(f.user_id ?? f.id) === myId || f.is_me)
    return me?.scores
  }, [rawNodes, meId])

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
      const vector = profileVector(f?.scores)
      const isMeNode = id === myId || !!f.is_me
      const seedX = ((f.position?.x ?? hash01(id)) * 0.72 + 0.14) * 800
      const seedY = ((f.position?.y ?? hash01(`${id}-y`)) * 0.72 + 0.14) * 600
      const node = {
        ...f,
        id,
        val: 1,
        x: seedX,
        y: seedY,
        dominantPetal,
        petalAngle: PETAL_ANGLE[dominantPetal] ?? 0,
        profileAngle: vector.angle,
        profileCoherence: vector.coherence,
        resonanceWithMe: isMeNode ? 1 : resonanceBetween(meNodeScores, f?.scores),
        complementarityWithMe: isMeNode
          ? 1
          : complementarityBetween(meNodeScores, f?.scores, f?.meteo_petal || null),
        meteoPetal: f?.meteo_petal ?? null,
        socialMode: f?.social_mode ?? 'open',
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
          linkList.push({ source: a, target: b, strength: 1, linkType: 'duo', curvature: 0.1 })
        }
      }
    })
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]
        const b = list[j]
        const key = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`
        if (linkSet.has(key)) continue
        const r = resonanceBetween(a.scores, b.scores)
        if (r >= RESONANCE_THRESHOLD) {
          linkSet.add(key)
          linkList.push({ source: a.id, target: b.id, strength: r * RESONANCE_STRENGTH, linkType: 'resonance', curvature: 0.18 })
        }
      }
    }
    return { nodes: list, links: linkList }
  }, [rawNodes, rawLinks, meId, meNodeScores])

  const nodeIdsKey = useMemo(() => nodes.map((n) => n.id).sort().join(','), [nodes])
  const linksKey = useMemo(
    () => links.map((l) => {
      const s = linkEndpointId(l.source)
      const t = linkEndpointId(l.target)
      return s < t ? `${s}-${t}` : `${t}-${s}`
    }).sort().join(','),
    [links],
  )
  const focusId = useMemo(() => {
    if (hoveredId) return hoveredId
    if (selectedUserId != null) return String(selectedUserId)
    return null
  }, [hoveredId, selectedUserId])
  const neighborIds = useMemo(() => buildNeighborSet(focusId, links, meNodeIdRef.current), [focusId, links])
  const navigableNodes = useMemo(
    () => nodes.filter((n) => nodeMatchesFilter(n, filterMode, petalFilter, searchQuery) && !n.isMe),
    [nodes, filterMode, petalFilter, searchQuery]
  )

  const getNodeVisualState = useCallback((node) => {
    const id = String(node.id)
    const visible = nodeMatchesFilter(node, filterMode, petalFilter, searchQuery)
    const isMe = node.isMe
    const isSelected = selectedUserId != null && Number(node.user_id) === Number(selectedUserId)
    const isHovered = hoveredId != null && id === hoveredId
    const inFocusNeighborhood = !focusId || (neighborIds?.has(id) ?? false)
    const q = String(searchQuery ?? '').trim().toLowerCase()
    const searchDim = q && !isMe && !String(node.pseudo ?? '').toLowerCase().includes(q)
    const showLabel = visible && !searchDim
    const dimmed = !visible || searchDim || (focusId != null && !inFocusNeighborhood)
    return { visible, dimmed, showLabel, isMe, isSelected, isHovered, searchHighlight: q && visible && !searchDim && !isMe, importance: nodeImportance(node) }
  }, [filterMode, petalFilter, searchQuery, focusId, neighborIds, selectedUserId, hoveredId])

  const scheduleSaveView = useCallback(() => {
    if (saveViewTimerRef.current) clearTimeout(saveViewTimerRef.current)
    saveViewTimerRef.current = setTimeout(() => {
      const cam = cameraRef.current
      const { x: gx, y: gy } = graphCenterTarget(nodes, w / 2, h / 2)
      saveGalaxieView({ zoom: cam.k, centerX: gx, centerY: gy, filterMode, petalFilter, neighborhood: filterMode === 'neighborhood' })
    }, SAVE_VIEW_DEBOUNCE_MS)
  }, [w, h, filterMode, petalFilter, nodes])

  const paintFlowerAtNode = useCallback((node, ctx, globalScale) => {
    try {
      const visual = getNodeVisualState(node)
      if (!visual.visible) return

      const petalsData = scoresToPetals(node.scores ?? {})
      const { isMe, isSelected, isHovered, dimmed, importance, searchHighlight } = visual
      const pulseT = isSelected ? (performance.now() - pulseStartRef.current) / 1000 : 0
      const pulse = isSelected && pulseT < 1.2 ? 1 + Math.sin(pulseT * 8) * 0.05 * (1 - pulseT / 1.2) : 1
      const gs = Math.max(0.45, globalScale || 1)
      const scale = (importance * (isSelected ? 1.1 : 1) * (isHovered ? 1.06 : 1) * pulse * (searchHighlight ? 1.04 : 1)) / gs
      const dimMul = dimmed ? 0.5 : 1
      const baseAlpha = (isSelected ? 1 : isHovered ? 0.96 : 0.9) * dimMul
      const BASE = isMe ? 24 : 18
      const coreR = isMe ? 7 : 5.5

      ctx.save()
      ctx.translate(node.x ?? 0, node.y ?? 0)
      ctx.scale(scale, scale)
      ctx.globalAlpha = dimMul

      // Ombre au sol
      ctx.beginPath()
      ctx.ellipse(1.5, 5, BASE * 1.45, BASE * 0.5, 0, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,0,0,0.14)'
      ctx.fill()

      PETALS.forEach((p) => {
        const intensity = Math.max(0.18, Math.min(1, petalsData[p.id] ?? 0.22))
        const pLen = BASE * (0.52 + intensity * 0.78)
        const pW = (isMe ? 10 : 7.5) * (0.48 + intensity * 0.58)
        const rad = (p.angle * Math.PI) / 180
        const cos = Math.cos(rad)
        const sin = Math.sin(rad)

        ctx.save()
        ctx.rotate(rad)

        drawCanvasPetal(ctx, pLen, pW, darkenHex(p.color, 0.38), baseAlpha * 0.42, cos * 1.4, sin * 1.4)
        drawCanvasPetal(ctx, pLen, pW, p.color, baseAlpha * (0.62 + intensity * 0.3))
        drawCanvasPetal(ctx, pLen * 0.76, pW * 0.28, lightenHex(p.color, 0.48), baseAlpha * (0.22 + intensity * 0.14))

        ctx.strokeStyle = darkenHex(p.color, 0.22)
        ctx.lineWidth = isMe ? 0.7 : 0.45
        ctx.globalAlpha = baseAlpha * 0.55
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.bezierCurveTo(-pW * 0.58, -pLen * 0.22, -pW * 0.42, -pLen * 0.72, 0, -pLen)
        ctx.bezierCurveTo(pW * 0.42, -pLen * 0.72, pW * 0.58, -pLen * 0.22, 0, 0)
        ctx.stroke()
        ctx.restore()
      })

      // Halo du cœur
      ctx.beginPath()
      ctx.arc(0, 0, coreR + 4.5, 0, Math.PI * 2)
      ctx.fillStyle = isMe ? 'rgba(253,230,138,0.22)' : 'rgba(255,255,255,0.14)'
      ctx.globalAlpha = baseAlpha
      ctx.fill()

      // Disque central
      const coreGrad = ctx.createRadialGradient(0, -coreR * 0.25, 0, 0, 0, coreR)
      if (isMe) {
        coreGrad.addColorStop(0, '#fffbeb')
        coreGrad.addColorStop(0.55, '#fde68a')
        coreGrad.addColorStop(1, '#f59e0b')
      } else {
        coreGrad.addColorStop(0, '#fff1f2')
        coreGrad.addColorStop(0.55, '#fecdd3')
        coreGrad.addColorStop(1, '#fb7185')
      }
      ctx.beginPath()
      ctx.arc(0, 0, coreR, 0, Math.PI * 2)
      ctx.fillStyle = coreGrad
      ctx.fill()
      ctx.strokeStyle = isMe ? '#d97706' : '#e11d48'
      ctx.lineWidth = isMe ? 1 : 0.75
      ctx.stroke()

      // Étamine
      const stamenN = isMe ? 8 : 6
      for (let i = 0; i < stamenN; i++) {
        const a = (i / stamenN) * Math.PI * 2
        const d = coreR * 0.58
        ctx.beginPath()
        ctx.arc(Math.cos(a) * d, Math.sin(a) * d, isMe ? 1.5 : 1.2, 0, Math.PI * 2)
        ctx.fillStyle = isMe ? 'rgba(217,119,6,0.9)' : 'rgba(225,29,72,0.85)'
        ctx.fill()
      }
      ctx.beginPath()
      ctx.arc(0, 0, coreR * 0.36, 0, Math.PI * 2)
      ctx.fillStyle = isMe ? '#fbbf24' : '#fb7185'
      ctx.fill()

      if (isSelected || isHovered) {
        ctx.beginPath()
        ctx.arc(0, 0, BASE * 1.05, 0, Math.PI * 2)
        ctx.strokeStyle = isSelected ? 'rgba(250,204,21,0.55)' : 'rgba(34,211,238,0.4)'
        ctx.lineWidth = isSelected ? 1.4 : 1
        ctx.globalAlpha = 0.85
        ctx.stroke()
      }

      if (!dimmed && (node?.presence?.is_online ?? node?.is_online)) {
        ctx.beginPath()
        ctx.arc(BASE * 0.72, -BASE * 0.62, isMe ? 2.8 : 2.3, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(34,197,94,0.95)'
        ctx.strokeStyle = 'rgba(2,6,23,0.7)'
        ctx.lineWidth = 0.8
        ctx.fill()
        ctx.stroke()
      }

      const meteoId = node?.meteoPetal
      if (!dimmed && meteoId && PETAL_BY_ID[meteoId]) {
        const mc = PETAL_BY_ID[meteoId].color
        ctx.beginPath()
        ctx.arc(0, 0, BASE * 1.12, 0, Math.PI * 2)
        ctx.strokeStyle = mc
        ctx.lineWidth = 1.1
        ctx.globalAlpha = 0.42
        ctx.stroke()
      }

      if (!dimmed && node?.socialMode === 'focus') {
        ctx.beginPath()
        ctx.arc(-BASE * 0.72, -BASE * 0.62, 2.2, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(167,139,250,0.9)'
        ctx.fill()
      }

      ctx.restore()
    } catch {
      try { ctx.restore() } catch {}
    }
  }, [getNodeVisualState])

  const drawLabelOnOverlay = useCallback((ctx, screenX, screenY, node, labelRects) => {
    const visual = getNodeVisualState(node)
    if (!visual.showLabel || visual.dimmed) return
    const { isMe, isSelected, isHovered } = visual
    const pseudo = truncateLabel(node.pseudo ?? 'Jardinier')
    const fontSize = isMe ? 11 : isSelected ? 10.5 : 9.5
    const flowerR = (isMe ? 30 : 24) * visual.importance * (isSelected ? 1.05 : 1)
    const labelX = screenX
    const labelY = screenY + flowerR + 8

    ctx.save()
    ctx.font = `500 ${fontSize}px ui-sans-serif, system-ui, sans-serif`
    const tw = ctx.measureText(pseudo).width + (isMe || isSelected || isHovered ? 14 : 4)
    const th = fontSize + (isMe || isSelected || isHovered ? 8 : 4)
    const rect = { x: labelX - tw / 2, y: labelY - th / 2, w: tw, h: th }
    if (labelRects.some((r) => rectsOverlap(rect, r))) return
    labelRects.push(rect)

    ctx.globalCompositeOperation = 'source-over'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    if (isMe || isSelected || isHovered) {
      ctx.globalAlpha = 1
      roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 5)
      ctx.fillStyle = 'rgba(2,6,23,0.88)'
      ctx.fill()
      ctx.strokeStyle = isSelected ? 'rgba(250,204,21,0.45)' : isHovered ? 'rgba(34,211,238,0.35)' : 'rgba(251,191,36,0.35)'
      ctx.lineWidth = 0.7
      ctx.stroke()
      ctx.fillStyle = isMe ? 'rgba(254,243,199,0.95)' : isSelected ? 'rgba(254,240,138,0.92)' : 'rgba(226,232,240,0.92)'
      ctx.fillText(pseudo, labelX, labelY)
    } else {
      ctx.globalAlpha = 0.9
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(2,6,23,0.82)'
      ctx.strokeText(pseudo, labelX, labelY)
      ctx.fillStyle = 'rgba(248,250,252,0.9)'
      ctx.fillText(pseudo, labelX, labelY)
    }
    ctx.restore()
  }, [getNodeVisualState])

  const paintOverlay = useCallback(() => {
    const g = fgRef.current
    const canvas = overlayRef.current
    if (!g || !canvas || !nodes.length) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
    ctx.clearRect(0, 0, w, h)

    const labelRects = []
    const sortedForLabels = [...nodes].sort((a, b) => {
      const av = getNodeVisualState(a)
      const bv = getNodeVisualState(b)
      const score = (n, v) => (v.isSelected ? 4 : 0) + (v.isHovered ? 3 : 0) + (v.isMe ? 2 : 0) + (n.isContact ? 1 : 0)
      return score(b, bv) - score(a, av)
    })
    for (const node of sortedForLabels) {
      if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) continue
      const scr = g.graph2ScreenCoords(node.x, node.y)
      if (!Number.isFinite(scr.x) || !Number.isFinite(scr.y)) continue
      if (scr.x < -80 || scr.y < -40 || scr.x > w + 80 || scr.y > h + 40) continue
      drawLabelOnOverlay(ctx, scr.x, scr.y, node, labelRects)
    }

    const duoLinks = links.filter((l) => l.linkType === 'duo')
    const resonanceLinks = links.filter((l) => l.linkType !== 'duo' && (l.strength ?? 0) >= 0.08)
    const particleLinks = duoLinks.length ? [...duoLinks, ...resonanceLinks.slice(0, 24)] : resonanceLinks.slice(0, 32)
    const now = performance.now()
    const linkIsRelevant = (link) => {
      if (!focusId) return true
      const sid = linkEndpointId(link.source), tid = linkEndpointId(link.target)
      return sid === focusId || tid === focusId
    }
    for (let i = 0; i < flowRef.current.length; i++) {
      const p = flowRef.current[i]
      const link = particleLinks[(p.linkIndex + i) % Math.max(1, particleLinks.length)]
      if (!link || !linkIsRelevant(link)) continue
      const src = typeof link.source === 'object' ? link.source : nodes.find((n) => n.id === link.source)
      const tgt = typeof link.target === 'object' ? link.target : nodes.find((n) => n.id === link.target)
      if (!src?.x || !tgt?.x) continue
      const t = (Math.sin(p.phase + now * p.speed) + 1) / 2
      const scr = g.graph2ScreenCoords(src.x + (tgt.x - src.x) * t, src.y + (tgt.y - src.y) * t)
      ctx.fillStyle = link.linkType === 'duo' ? `rgba(167,139,250,${0.28 + t * 0.35})` : `rgba(74,222,128,${0.18 + t * 0.28})`
      ctx.beginPath()
      ctx.arc(scr.x, scr.y, p.radius, 0, 2 * Math.PI)
      ctx.fill()
    }
  }, [nodes, links, w, h, focusId, getNodeVisualState, drawLabelOnOverlay])

  const handleRenderFramePost = useCallback(() => {
    try { paintOverlay() } catch { /* labels / particules non bloquants */ }
  }, [paintOverlay])

  const scheduleOverlayPaint = useCallback(() => {
    if (paintRafRef.current != null) return
    paintRafRef.current = requestAnimationFrame(() => { paintRafRef.current = null; paintOverlay() })
  }, [paintOverlay])

  const applyCameraCenter = useCallback((animateMs = 0, autoFit = true) => {
    const g = fgRef.current
    if (!g || w <= 0 || h <= 0 || !nodes.length) return
    const me = nodes.find((n) => n.isMe)
    const gx = me?.x ?? w / 2
    const gy = me?.y ?? h / 2
    g.centerAt(gx, gy, animateMs)
    if (autoFit) {
      const k = computeFitZoom(nodes, me, w, h)
      g.zoom(k, animateMs)
      zoomLevelRef.current = k
      cameraRef.current = { ...cameraRef.current, k }
    }
    scheduleOverlayPaint()
  }, [nodes, w, h, scheduleOverlayPaint])

  useEffect(() => {
    applyCameraCenterRef.current = applyCameraCenter
  }, [applyCameraCenter])

  const graphData = useMemo(() => ({ nodes, links }), [nodes, links])
  const neighborhoodMode = filterMode === 'neighborhood'

  const applyGraphLayout = useCallback(() => {
    const g = fgRef.current
    if (!g || !nodes.length || w <= 0 || h <= 0) return false
    const cx = w / 2, cy = h / 2, minDim = Math.min(w, h)
    const layoutKey = `${nodeIdsKey}|${w}|${h}|${neighborhoodMode}`

    layoutConstellation(nodes, cx, cy, minDim, neighborhoodMode)

    nodes.forEach((n) => {
      n.fx = n.x
      n.fy = n.y
      n.vx = 0
      n.vy = 0
    })

    const layoutChanged = lastLayoutKeyRef.current !== layoutKey
    if (layoutChanged) {
      lastLayoutKeyRef.current = layoutKey
      // Liens décoratifs seulement — les nœuds sont épinglés, pas de physique active
      g.d3Force('link', forceLink().id((d) => d.id)
        .distance((l) => l.linkType === 'duo' ? 150 : 200)
        .strength(0))
      g.d3Force('charge', null)
      g.d3Force('center', null)
      g.d3Force('radial', null)
      g.d3Force('petalX', null)
      g.d3Force('petalY', null)
      g.d3Force('collide', null)
    }

    g.refresh?.()
    return layoutChanged
  }, [nodes, w, h, nodeIdsKey, neighborhoodMode])

  useEffect(() => {
    applyGraphLayoutRef.current = applyGraphLayout
  }, [applyGraphLayout])

  const handleEngineStop = useCallback(() => {
    if (pendingCameraCenterRef.current) {
      applyCameraCenterRef.current?.(0, true)
      pendingCameraCenterRef.current = false
    }
    scheduleOverlayPaint()
  }, [scheduleOverlayPaint])

  useImperativeHandle(ref, () => ({
    centerOnMe() {
      const g = fgRef.current
      if (!g) return
      applyCameraCenter(650, true)
      pulseStartRef.current = performance.now()
    },
    focusOnUser(userId) {
      const g = fgRef.current
      const node = nodes.find((n) => String(n.user_id) === String(userId))
      if (!g || !node?.x) return
      g.centerAt(node.x, node.y, 600)
      g.zoom(Math.min(1.85, MAX_ZOOM), 600)
      pulseStartRef.current = performance.now()
    },
    resetView() {
      const g = fgRef.current
      if (!g) return
      applyCameraCenter(650, true)
    },
    getNodeScreenPosition(userId) {
      const g = fgRef.current
      if (!g) return null
      const node = nodes.find((n) => String(n.user_id) === String(userId))
      if (!node || !Number.isFinite(node.x) || !Number.isFinite(node.y)) return null
      const scr = g.graph2ScreenCoords(node.x, node.y)
      if (!Number.isFinite(scr.x) || !Number.isFinite(scr.y)) return null
      return { x: scr.x, y: scr.y }
    },
  }), [nodes, applyCameraCenter])

  useEffect(() => () => {
    if (paintRafRef.current) cancelAnimationFrame(paintRafRef.current)
    if (saveViewTimerRef.current) clearTimeout(saveViewTimerRef.current)
  }, [])

  const paintPointerArea = useCallback((node, color, ctx) => {
    if (!nodeMatchesFilter(node, filterMode, petalFilter, searchQuery)) return
    ctx.beginPath()
    ctx.arc(node.x ?? 0, node.y ?? 0, (NODE_R + 10) * nodeImportance(node), 0, 2 * Math.PI)
    ctx.fillStyle = color
    ctx.fill()
  }, [filterMode, petalFilter, searchQuery])

  const bindForceGraph = useCallback((inst) => {
    if (inst === fgRef.current) return
    fgRef.current = inst
    if (!inst) return
    requestAnimationFrame(() => {
      const g = fgRef.current
      if (!g) return
      if (applyGraphLayoutRef.current()) {
        g.refresh?.()
        applyCameraCenterRef.current?.(0, true)
      }
    })
  }, [])

  useEffect(() => {
    const g = fgRef.current
    if (!g || !nodes.length || w <= 0 || h <= 0) return
    let shouldCenter = false
    if (applyGraphLayoutRef.current()) shouldCenter = true
    if (lastCameraDimsRef.current.w !== w || lastCameraDimsRef.current.h !== h) {
      lastCameraDimsRef.current = { w, h }
      shouldCenter = true
    }
    if (shouldCenter) {
      pendingCameraCenterRef.current = true
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!pendingCameraCenterRef.current) return
          applyCameraCenterRef.current?.(0, true)
          pendingCameraCenterRef.current = false
        })
      })
    }
  }, [nodeIdsKey, linksKey, w, h, neighborhoodMode])

  useEffect(() => { scheduleOverlayPaint() }, [scheduleOverlayPaint, nodes, links, w, h, selectedUserId, hoveredId, filterMode, petalFilter, searchQuery, focusId])

  useEffect(() => {
    const onKey = (e) => {
      if (!navigableNodes.length) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        setKeyboardIdx((i) => {
          const next = i < 0 ? 0 : (i + 1) % navigableNodes.length
          const n = navigableNodes[next]
          setHoveredId(n.id)
          return next
        })
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        setKeyboardIdx((i) => {
          const next = i <= 0 ? navigableNodes.length - 1 : i - 1
          const n = navigableNodes[next]
          setHoveredId(n.id)
          return next
        })
      } else if (e.key === 'Enter' && keyboardIdx >= 0) onNodeClick?.(navigableNodes[keyboardIdx])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigableNodes, keyboardIdx, onNodeClick])

  const hoveredNode = useMemo(() => (hoveredId ? nodes.find((n) => n.id === hoveredId) : null), [hoveredId, nodes])
  if (!nodes.length) return null

  return (
    <div ref={wrapperRef} className="absolute inset-0 w-full h-full z-[8]" style={{ overflow: 'hidden' }} role="application" aria-label="Grand Jardin galaxie">
      {dimsMeasured && w > 0 && h > 0 && (
        <>
          <ForceGraph2D
            ref={bindForceGraph}
            graphData={graphData}
            width={w}
            height={h}
            nodeId="id"
            nodeColor="rgba(0,0,0,0)"
            nodeVal={1}
            nodeCanvasObjectMode={() => 'replace'}
            nodeCanvasObject={(node, ctx, globalScale) => paintFlowerAtNode(node, ctx, globalScale)}
            backgroundColor="transparent"
            onRenderFramePost={handleRenderFramePost}
            onEngineStop={handleEngineStop}
            nodePointerAreaPaint={paintPointerArea}
            linkVisibility={(l) => {
              if (l.linkType === 'duo') return true
              if (filterMode === 'neighborhood') {
                return linkTouchesMe(l, meNodeIdRef.current)
              }
              return (l.strength ?? 0) >= 0.08
            }}
            linkWidth={(l) => {
              const isDuo = l.linkType === 'duo'
              const mine = linkTouchesMe(l, meNodeIdRef.current)
              if (isDuo) return mine ? 2.4 : 1.8
              const s = l.strength ?? 0
              return mine ? 0.9 + s * 1.2 : 0.55 + s * 0.8
            }}
            linkCurvature={(l) => l.linkType === 'duo' ? (l.curvature ?? 0.12) : (l.curvature ?? 0.06)}
            linkColor={(l) => {
              const isDuo = l.linkType === 'duo'
              const sid = linkEndpointId(l.source), tid = linkEndpointId(l.target)
              const inFocus = !focusId || sid === focusId || tid === focusId
              const mine = linkTouchesMe(l, meNodeIdRef.current)
              const strength = l.strength ?? 0
              if (isDuo) {
                const a = (mine ? 0.62 : 0.45) * (inFocus ? 1 : 0.75)
                return `rgba(167,139,250,${a})`
              }
              const a = (mine ? 0.28 + strength * 0.35 : 0.16 + strength * 0.22) * (inFocus ? 1 : 0.7)
              return `rgba(96,200,220,${Math.min(0.55, a)})`
            }}
            linkCanvasObjectMode={() => 'after'}
            linkCanvasObject={(link, ctx) => {
              const isDuo = link.linkType === 'duo'
              const sid = linkEndpointId(link.source), tid = linkEndpointId(link.target)
              const inFocus = !focusId || sid === focusId || tid === focusId
              const mine = linkTouchesMe(link, meNodeIdRef.current)
              const strength = link.strength ?? 0
              ctx.save()
              ctx.globalCompositeOperation = 'lighter'
              if (isDuo) {
                ctx.strokeStyle = `rgba(192,132,252,${mine ? (inFocus ? 0.55 : 0.42) : (inFocus ? 0.38 : 0.28)})`
                ctx.lineWidth = mine ? 2.8 : 2
                ctx.shadowColor = 'rgba(167,139,250,0.65)'
                ctx.shadowBlur = mine ? 10 : 6
              } else {
                ctx.strokeStyle = `rgba(74,222,128,${mine ? (inFocus ? 0.32 + strength * 0.2 : 0.22) : (inFocus ? 0.18 : 0.12)})`
                ctx.lineWidth = mine ? 1.4 + strength * 0.8 : 0.9 + strength * 0.5
                ctx.shadowColor = 'rgba(74,222,128,0.45)'
                ctx.shadowBlur = 4
              }
              ctx.beginPath()
              ctx.moveTo(link.source.x, link.source.y)
              ctx.lineTo(link.target.x, link.target.y)
              ctx.stroke()
              ctx.restore()
            }}
            onNodeClick={(node) => { if (!nodeMatchesFilter(node, filterMode, petalFilter, searchQuery)) return; pulseStartRef.current = performance.now(); onNodeClick?.(node) }}
            onBackgroundClick={() => onBackgroundClick?.()}
            onNodeHover={(node) => {
              if (node && !nodeMatchesFilter(node, filterMode, petalFilter, searchQuery)) { setHoveredId(null); setHoverScreen(null); return }
              setHoveredId(node ? node.id : null)
              if (node && fgRef.current) setHoverScreen(fgRef.current.graph2ScreenCoords(node.x, node.y))
              else setHoverScreen(null)
              scheduleOverlayPaint()
            }}
            enableNodeDrag={false}
            enablePanInteraction
            enableZoomInteraction
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            onZoom={(t) => {
              zoomLevelRef.current = t?.k ?? 1
              cameraRef.current = { k: t?.k ?? 1, x: t?.x ?? 0, y: t?.y ?? 0 }
              setCameraTick((v) => v + 1)
              onCameraChange?.()
              scheduleOverlayPaint()
              scheduleSaveView()
            }}
            d3AlphaDecay={0.08}
            d3VelocityDecay={0.85}
            warmupTicks={0}
            cooldownTicks={0}
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
              zIndex: 12,
            }}
            aria-hidden
          />
          {hoveredNode && hoverScreen && (
            <GalaxieTooltip node={hoveredNode} x={hoverScreen.x} y={hoverScreen.y} containerW={w} containerH={h} />
          )}
          <div className="absolute bottom-3 right-3 z-[25] flex flex-col items-end gap-2 pointer-events-auto">
            <GalaxieMinimap
              key={cameraTick}
              width={w}
              height={h}
              graphW={w}
              graphH={h}
              nodes={nodes}
              zoom={cameraRef.current.k}
              panX={cameraRef.current.x}
              panY={cameraRef.current.y}
              onNavigate={(gx, gy) => { fgRef.current?.centerAt(gx, gy, 450); scheduleSaveView() }}
            />
            <GalaxieLegend collapsed={legendCollapsed} onToggle={() => setLegendCollapsed((v) => !v)} />
          </div>
        </>
      )}
    </div>
  )
})
