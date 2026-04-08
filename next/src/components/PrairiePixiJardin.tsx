// @ts-nocheck
'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as PIXI from 'pixi.js'

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n))
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function hash01(str) {
  const s = String(str ?? '')
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}

function flowerColors(scores = {}, isMe = false) {
  // Palette “jardin réel” (feuillage / terre / lumière)
  const agape = Number(scores?.agape ?? 0) / 3
  const philia = Number(scores?.philia ?? 0) / 3
  const eros = Number(scores?.eros ?? 0) / 3

  const leaf = PIXI.Color.shared.setValue('#1f7a4a').toNumber()
  const moss = PIXI.Color.shared.setValue('#2a9d5b').toNumber()
  const amber = PIXI.Color.shared.setValue('#f59e0b').toNumber()
  const rose = PIXI.Color.shared.setValue('#fb7185').toNumber()
  const violet = PIXI.Color.shared.setValue('#8b5cf6').toNumber()

  const accent = eros > 0.66 ? rose : philia > 0.66 ? violet : amber
  const petal = PIXI.Color.shared.setValue('#e8f7ee').toNumber()
  const petal2 = PIXI.Color.shared.setValue('#bfead2').toNumber()

  const stem = lerp(leaf, moss, clamp(agape * 0.85, 0, 1))
  const core = isMe ? amber : accent
  return { stem, core, petal, petal2 }
}

function buildFlower({ id, pseudo, avatarEmoji, scores, isMe, isOnline, selected }) {
  const g = new PIXI.Container()
  g.eventMode = 'static'
  g.cursor = isMe ? 'default' : 'pointer'

  const { stem, core, petal, petal2 } = flowerColors(scores, isMe)
  const seed = hash01(id)

  // Soft halo
  const halo = new PIXI.Graphics()
  halo.beginFill(selected ? 0xa78bfa : isOnline ? 0x34d399 : 0x1f7a4a, selected ? 0.22 : isOnline ? 0.14 : 0.10)
  halo.drawCircle(0, 0, isMe ? 24 : 20)
  halo.endFill()
  halo.filters = [new PIXI.BlurFilter(6)]
  g.addChild(halo)

  // Petals (simple “feuilles” elliptiques)
  const petals = new PIXI.Graphics()
  const n = 8
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + seed * 0.6
    const len = 14 + hash01(`${id}:${i}`) * 10
    const w = 6 + hash01(`${id}:w:${i}`) * 4
    const x = Math.cos(a) * 2
    const y = Math.sin(a) * 2
    petals.beginFill(i % 2 === 0 ? petal : petal2, 0.55)
    petals.lineStyle(1, stem, 0.35)
    petals.drawEllipse(x + Math.cos(a) * 6, y + Math.sin(a) * 6, w, len)
    petals.endFill()
  }
  petals.rotation = seed * 0.4
  g.addChild(petals)

  // Core
  const coreG = new PIXI.Graphics()
  coreG.beginFill(core, isMe ? 0.95 : 0.9)
  coreG.drawCircle(0, 0, isMe ? 7 : 6)
  coreG.endFill()
  coreG.lineStyle(1, 0x0b1b11, 0.35)
  coreG.drawCircle(0, 0, isMe ? 7 : 6)
  g.addChild(coreG)

  // Presence dot
  if (isOnline) {
    const dot = new PIXI.Graphics()
    dot.beginFill(0x22c55e, 0.95)
    dot.drawCircle(12, -10, 3)
    dot.endFill()
    dot.lineStyle(1, 0x0b1220, 0.5)
    dot.drawCircle(12, -10, 3)
    g.addChild(dot)
  }

  // Emoji
  if (avatarEmoji) {
    const t = new PIXI.Text(String(avatarEmoji), {
      fontFamily: 'system-ui, Segoe UI, sans-serif',
      fontSize: isMe ? 14 : 12,
      fill: 0xffffff,
    })
    t.anchor.set(0.5, 0)
    t.position.set(0, 10)
    t.alpha = 0.95
    g.addChild(t)
  }

  // Pseudo pill (simple)
  if (pseudo) {
    const label = new PIXI.Text(String(pseudo), {
      fontFamily: 'system-ui, Segoe UI, sans-serif',
      fontSize: 10,
      fill: 0xf8fafc,
    })
    label.anchor.set(0.5, 0.5)
    label.position.set(0, 30)

    const padX = 8
    const pill = new PIXI.Graphics()
    const w = label.width + padX * 2
    const h = 18
    const r = 9
    pill.beginFill(0x020617, 0.55)
    pill.lineStyle(1, selected ? 0xa78bfa : 0xffffff, selected ? 0.45 : 0.12)
    pill.roundRect(-w / 2, -h / 2, w, h, r)
    pill.endFill()
    pill.filters = [new PIXI.BlurFilter(0.5)]
    pill.position.set(0, 30)
    g.addChild(pill, label)
  }

  // Slight sway params
  g.__seed = seed
  g.__petals = petals
  g.__halo = halo
  g.__baseScale = isMe ? 1.06 : 1
  return g
}

export function PrairiePixiJardin({
  fleurs = [],
  links = [],
  meId,
  selectedUserId,
  onSelectUserId,
}) {
  const hostRef = useRef(null)
  const appRef = useRef(null)
  const nodesRef = useRef(new Map())
  const linksRef = useRef(null)

  const fleurById = useMemo(() => {
    const m = new Map()
    fleurs.forEach((f) => {
      const uid = Number(f?.user_id)
      if (!uid) return
      m.set(uid, f)
    })
    return m
  }, [fleurs])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const app = new PIXI.Application()
    appRef.current = app

    let destroyed = false
    ;(async () => {
      await app.init({
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        resizeTo: host,
      })
      if (destroyed) return
      host.appendChild(app.canvas)

      // Background “jardin réel” (brume + vignette)
      const bg = new PIXI.Container()
      const fog = new PIXI.Graphics()
      fog.beginFill(0x052e1a, 0.10)
      fog.drawRect(0, 0, 10, 10)
      fog.endFill()
      fog.filters = [new PIXI.BlurFilter(18)]
      bg.addChild(fog)

      const vignette = new PIXI.Graphics()
      vignette.beginFill(0x020617, 0.22)
      vignette.drawRect(0, 0, 10, 10)
      vignette.endFill()
      vignette.filters = [new PIXI.BlurFilter(10)]
      bg.addChild(vignette)

      app.stage.addChild(bg)

      // Links layer
      const linkLayer = new PIXI.Graphics()
      linkLayer.alpha = 0.9
      linksRef.current = linkLayer
      app.stage.addChild(linkLayer)

      // Nodes layer
      const nodeLayer = new PIXI.Container()
      app.stage.addChild(nodeLayer)

      const fit = () => {
        const w = app.renderer.width
        const h = app.renderer.height
        fog.clear()
        fog.beginFill(0x0b3b22, 0.12)
        fog.drawEllipse(w * 0.2, h * 0.2, w * 0.55, h * 0.42)
        fog.drawEllipse(w * 0.78, h * 0.3, w * 0.52, h * 0.38)
        fog.drawEllipse(w * 0.55, h * 0.82, w * 0.70, h * 0.48)
        fog.endFill()

        vignette.clear()
        vignette.beginFill(0x020617, 0.26)
        vignette.drawRect(0, 0, w, h)
        vignette.endFill()

        // Make vignette stronger at edges with blend
        vignette.alpha = 0.18
      }

      fit()
      app.renderer.on('resize', fit)

      // Ticker for “wind”
      app.ticker.add((t) => {
        const now = performance.now() / 1000
        nodesRef.current.forEach((node) => {
          const seed = node.__seed ?? 0
          const sway = Math.sin(now * (0.55 + seed * 0.25) + seed * 12.3) * 0.06
          if (node.__petals) node.__petals.rotation = sway + seed * 0.4
          node.scale.set((node.__baseScale ?? 1) * (1 + Math.sin(now * 0.7 + seed * 4.4) * 0.01))
        })
      })
    })()

    return () => {
      destroyed = true
      try {
        if (app?.canvas?.parentNode === host) host.removeChild(app.canvas)
      } catch {}
      try {
        app.destroy(true)
      } catch {}
      appRef.current = null
      nodesRef.current = new Map()
    }
  }, [])

  // Sync nodes + links
  useEffect(() => {
    const app = appRef.current
    if (!app) return

    const w = app.renderer.width
    const h = app.renderer.height
    const nodeLayer = app.stage.children.find((c) => c instanceof PIXI.Container && c !== linksRef.current)
    const linkLayer = linksRef.current
    if (!nodeLayer || !linkLayer) return

    // Upsert nodes
    const nextIds = new Set()
    fleurs.forEach((f) => {
      const uid = Number(f?.user_id)
      if (!uid) return
      nextIds.add(uid)
      const id = String(uid)
      const isMe = uid === Number(meId)
      const selected = selectedUserId != null && Number(selectedUserId) === uid
      const isOnline = !!f?.presence?.is_online

      let node = nodesRef.current.get(uid)
      if (!node) {
        node = buildFlower({
          id,
          pseudo: f?.pseudo ?? '',
          avatarEmoji: f?.avatar_emoji,
          scores: f?.scores ?? {},
          isMe,
          isOnline,
          selected,
        })
        node.on('pointertap', () => {
          if (isMe) return
          onSelectUserId?.(uid)
        })
        nodesRef.current.set(uid, node)
        nodeLayer.addChild(node)
      }

      // Position mapping from existing prairie logic:
      // left% = 36 + x*28 ; top% = 36 + y*28
      const px = ((36 + (f.position?.x ?? 0) * 28) / 100) * w
      const py = ((36 + (f.position?.y ?? 0) * 28) / 100) * h
      node.position.set(px, py)

      // Selection emphasis
      const s = (isMe ? 1.06 : 1) * (selected ? 1.08 : 1)
      node.__baseScale = s
      if (node.__halo) node.__halo.alpha = selected ? 0.22 : isOnline ? 0.14 : 0.10
    })

    // Remove stale
    for (const [uid, node] of nodesRef.current.entries()) {
      if (!nextIds.has(uid)) {
        try { node.destroy({ children: true }) } catch {}
        nodesRef.current.delete(uid)
      }
    }

    // Draw links as curved “lianes”
    linkLayer.clear()
    linkLayer.lineStyle(1, 0x1f7a4a, 0.18)
    links.forEach((l) => {
      const a = Number(l?.user_a)
      const b = Number(l?.user_b)
      if (!a || !b) return
      const na = nodesRef.current.get(a)
      const nb = nodesRef.current.get(b)
      if (!na || !nb) return
      const x1 = na.x, y1 = na.y
      const x2 = nb.x, y2 = nb.y
      const dx = x2 - x1
      const dy = y2 - y1
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > Math.min(w, h) * 0.55) return

      const mx = (x1 + x2) / 2
      const my = (y1 + y2) / 2
      // Perp offset for organic curve
      const nx = -dy / (dist || 1)
      const ny = dx / (dist || 1)
      const bend = clamp(18 + dist * 0.12, 18, 60) * (hash01(`${a}-${b}`) > 0.5 ? 1 : -1)
      const cx = mx + nx * bend
      const cy = my + ny * bend

      const active =
        (selectedUserId != null && (Number(selectedUserId) === a || Number(selectedUserId) === b)) ||
        (meId != null && (Number(meId) === a || Number(meId) === b))
      const alpha = active ? 0.35 : 0.16
      const color = active ? 0xa78bfa : 0x34d399
      const width = active ? 1.5 : 1

      linkLayer.lineStyle(width, color, alpha)
      linkLayer.moveTo(x1, y1)
      linkLayer.quadraticCurveTo(cx, cy, x2, y2)
    })
  }, [fleurs, links, meId, selectedUserId, onSelectUserId])

  return <div ref={hostRef} className="absolute inset-0" />
}

