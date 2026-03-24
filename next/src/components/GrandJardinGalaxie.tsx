// @ts-nocheck
'use client'

import { useMemo, useRef, useEffect, useCallback } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { forceCollide, forceLink, forceManyBody, forceCenter, forceRadial } from 'd3-force-3d'
import { scoresToPetals } from '@/components/FlowerSVG'

const PETALS = [
  { id: 'agape', angle: 0, color: '#f43f5e' },
  { id: 'philautia', angle: 45, color: '#f59e0b' },
  { id: 'mania', angle: 90, color: '#ef4444' },
  { id: 'storge', angle: 135, color: '#0d9488' },
  { id: 'pragma', angle: 180, color: '#6366f1' },
  { id: 'philia', angle: 225, color: '#10b981' },
  { id: 'ludus', angle: 270, color: '#0ea5e9' },
  { id: 'eros', angle: 315, color: '#8b5cf6' },
]

const MIN_LEN = 4
const MAX_LEN = 14
const PETAL_W = 3
const NODE_R = 18

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
  width,
  height,
  onNodeClick,
  onBackgroundClick,
}) {
  const fgRef = useRef(null)
  const overlayRef = useRef(null)
  const w = Math.max(300, width ?? 600)
  const h = Math.max(300, height ?? 400)

  const { nodes, links } = useMemo(() => {
    const nodeMap = new Map()
    const list = []
    rawNodes.forEach((f) => {
      const id = String(f.user_id ?? f.id ?? Math.random())
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
          linkList.push({ source: a, target: b, strength: 1 })
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
          linkList.push({ source: a.id, target: b.id, strength: r * RESONANCE_STRENGTH })
        }
      }
    }
    return { nodes: list, links: linkList }
  }, [rawNodes, rawLinks])

  const drawFlowerOnCanvas = useCallback(
    (ctx, screenX, screenY, node) => {
      const petalsData = scoresToPetals(node.scores ?? {})
      const isMe = node.user_id === meId || node.is_me
      const scale = 1.5

      ctx.save()
      ctx.translate(screenX, screenY)
      ctx.scale(scale, scale)

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
        ctx.globalAlpha = 0.6 + intensity * 0.4
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
      ctx.strokeStyle = isMe ? '#d97706' : '#f43f5e'
      ctx.lineWidth = isMe ? 1.2 : 0.8
      ctx.stroke()

      // Nom sous la fleur
      const label = `${node.pseudo ?? ''} ${node.avatar_emoji ?? '🌸'}`.trim() || 'Fleur'
      ctx.restore()
      ctx.save()
      ctx.translate(screenX, screenY + 22)
      ctx.font = '11px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'
      ctx.lineWidth = 2
      ctx.strokeText(label, 0, 0)
      ctx.fillText(label, 0, 0)
      ctx.restore()
    },
    [meId]
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
      if (gx == null || gy == null) return
      const { x: sx, y: sy } = g.graph2ScreenCoords(gx, gy)
      drawFlowerOnCanvas(ctx, sx, sy, node)
    })
  }, [nodes, w, h, drawFlowerOnCanvas])

  const paintPointerArea = useCallback((node, color, ctx) => {
    const x = node.x ?? 0
    const y = node.y ?? 0
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x, y, NODE_R, 0, 2 * Math.PI)
    ctx.fill()
  }, [])

  const graphData = useMemo(() => ({ nodes, links }), [nodes, links])

  useEffect(() => {
    const g = fgRef.current
    if (!g || !nodes.length) return
    g.d3Force('link', forceLink()
      .id((d) => d.id)
      .distance((link) => Math.max(40, 120 - (link.strength ?? 0.5) * 100))
      .strength((link) => Math.min(0.8, (link.strength ?? 0.5) * 0.7))
    )
    g.d3Force('charge', forceManyBody().strength(-120))
    g.d3Force('center', forceCenter(0, 0))
    g.d3Force('radial', forceRadial(0, 0, 0).strength(0.08))
    g.d3Force('collide', forceCollide(NODE_R + 4))
    g.d3ReheatSimulation()
  }, [nodes, links])

  if (!nodes.length) {
    return null
  }

  return (
    <div className="absolute inset-0 w-full h-full" style={{ position: 'relative' }}>
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        width={w}
        height={h}
        nodeId="id"
        nodeColor="rgba(0,0,0,0)"
        nodeVal={0.5}
        onEngineTick={paintOverlay}
        nodePointerAreaPaint={paintPointerArea}
        nodeLabel={(n) => `${n.pseudo ?? ''} ${n.avatar_emoji ?? '🌸'}`.trim() || 'Fleur'}
        linkVisibility={(l) => (l.strength ?? 0) >= 0.3}
        linkWidth={0.8}
        linkColor="rgba(134,239,172,0.4)"
        backgroundColor="transparent"
        onNodeClick={(node) => onNodeClick?.(node)}
        onBackgroundClick={() => onBackgroundClick?.()}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
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
