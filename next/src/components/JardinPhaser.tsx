// @ts-nocheck
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

/* ── Helpers ─────────────────────────────────────────────── */
function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)) }

function hash01(str: string) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 10000) / 10000
}

const PETALS_DEF = [
  { id: 'agape',     angle: 0,   color: 0xff6b8a },  // rose tendre
  { id: 'philautia', angle: 45,  color: 0xf59e0b },  // ambre doré
  { id: 'mania',     angle: 90,  color: 0xff6030 },  // corail vif
  { id: 'storge',    angle: 135, color: 0x2dd4bf },  // teal lumineux
  { id: 'pragma',    angle: 180, color: 0x818cf8 },  // indigo doux
  { id: 'philia',    angle: 225, color: 0x34d399 },  // émeraude
  { id: 'ludus',     angle: 270, color: 0x38bdf8 },  // ciel azur
  { id: 'eros',      angle: 315, color: 0xc084fc },  // lavande vive
]

function scalePetals(scores: Record<string, number> | undefined) {
  const out: Record<string, number> = {}
  for (const p of PETALS_DEF) out[p.id] = clamp(Number(scores?.[p.id] ?? 0) / 3, 0.15, 1)
  return out
}

function cubicBez(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number, steps: number,
) {
  const pts: Array<{ x: number; y: number }> = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, mt = 1 - t, mt2 = mt * mt, t2 = t * t
    pts.push({
      x: mt2 * mt * ax + 3 * mt2 * t * bx + 3 * mt * t2 * cx + t2 * t * dx,
      y: mt2 * mt * ay + 3 * mt2 * t * by + 3 * mt * t2 * cy + t2 * t * dy,
    })
  }
  return pts
}

function darkenColor(hex: number, factor: number): number {
  const r = Math.round(((hex >> 16) & 0xff) * factor)
  const g = Math.round(((hex >> 8) & 0xff) * factor)
  const b = Math.round((hex & 0xff) * factor)
  return (r << 16) | (g << 8) | b
}
function lightenColor(hex: number, factor: number): number {
  const r = Math.round(((hex >> 16) & 0xff) + (255 - ((hex >> 16) & 0xff)) * factor)
  const g = Math.round(((hex >> 8) & 0xff) + (255 - ((hex >> 8) & 0xff)) * factor)
  const b = Math.round((hex & 0xff) + (255 - (hex & 0xff)) * factor)
  return (r << 16) | (g << 8) | b
}

function drawFlower(g: any, petals: Record<string, number>, isMe: boolean, selected: boolean) {
  g.clear()

  const BASE = isMe ? 27 : 20
  const CW   = isMe ? 7  : 5.5
  const STEPS = 9

  // Sol / ombre projetée
  g.fillStyle(0x000000, 0.13)
  g.fillEllipse(2, 5, BASE * 1.6, BASE * 0.65)

  for (const p of PETALS_DEF) {
    const intensity = petals[p.id] ?? 0.15
    // Pétale plus long et plus ouvert quand le score est élevé
    const pLen  = BASE * (0.48 + intensity * 0.82)
    const pW    = (isMe ? 10 : 7.5) * (0.45 + intensity * 0.60)

    const rad = (p.angle * Math.PI) / 180
    const cos = Math.cos(rad), sin = Math.sin(rad)
    const px = -sin, py = cos               // perpendiculaire

    const tipX = cos * pLen, tipY = sin * pLen

    // Points de contrôle : forme arrondie et renflée au milieu
    const c1x = cos * pLen * 0.28 + px * pW,       c1y = sin * pLen * 0.28 + py * pW
    const c2x = cos * pLen * 0.78 + px * pW * 0.35, c2y = sin * pLen * 0.78 + py * pW * 0.35

    const right = cubicBez(0, 0,   c1x,  c1y,  c2x,  c2y,  tipX, tipY, STEPS)
    const left  = cubicBez(tipX, tipY,
      cos * pLen * 0.78 - px * pW * 0.35, sin * pLen * 0.78 - py * pW * 0.35,
      cos * pLen * 0.28 - px * pW,        sin * pLen * 0.28 - py * pW, 0, 0, STEPS)
    const pts = [...right, ...left]

    // Couche 1 — ombre portée (légèrement décalée)
    g.fillStyle(darkenColor(p.color, 0.42), 0.55)
    g.fillPoints(pts.map(pt => ({ x: pt.x + cos * 1.8, y: pt.y + sin * 1.8 })), true)

    // Couche 2 — couleur principale du pétale
    g.fillStyle(p.color, 0.68 + intensity * 0.27)
    g.fillPoints(pts, true)

    // Couche 3 — reflet clair le long de la nervure centrale
    const hLen = pLen * 0.78, hW = pW * 0.25
    const hr = cubicBez(0, 0,
      cos * hLen * 0.28 + px * hW, sin * hLen * 0.28 + py * hW,
      cos * hLen * 0.78 + px * hW * 0.3, sin * hLen * 0.78 + py * hW * 0.3,
      cos * hLen, sin * hLen, STEPS)
    const hl = cubicBez(cos * hLen, sin * hLen,
      cos * hLen * 0.78 - px * hW * 0.3, sin * hLen * 0.78 - py * hW * 0.3,
      cos * hLen * 0.28 - px * hW,       sin * hLen * 0.28 - py * hW, 0, 0, STEPS)
    g.fillStyle(lightenColor(p.color, 0.55), 0.26 + intensity * 0.12)
    g.fillPoints([...hr, ...hl], true)
  }

  // Halo lumineux du cœur
  g.fillStyle(0xffffff, 0.13)
  g.fillCircle(0, 0, CW + 5)

  // Disque central
  g.fillStyle(isMe ? 0xfde68a : 0xffe4e6, 1)
  g.fillCircle(0, 0, CW)

  // Étamines (petits points autour du disque)
  const nS = isMe ? 8 : 6
  for (let i = 0; i < nS; i++) {
    const a = (i / nS) * Math.PI * 2
    const d = CW * 0.62
    g.fillStyle(isMe ? 0xd97706 : 0xe11d48, 0.88)
    g.fillCircle(Math.cos(a) * d, Math.sin(a) * d, isMe ? 1.8 : 1.4)
  }

  // Pistil central
  g.fillStyle(isMe ? 0xfbbf24 : 0xfb7185, 1)
  g.fillCircle(0, 0, CW * 0.38)

  // Anneau de sélection
  if (selected) {
    g.lineStyle(2.5, 0xc4b5fd, 0.92)
    g.strokeCircle(0, 0, CW + 9)
  }
}

/* ── Composant ───────────────────────────────────────────── */
export function JardinPhaser({
  fleurs = [], links = [], meId, selectedUserId, width, height, onSelectUserId, onBackgroundClick,
}: {
  fleurs?: any[]; links?: any[]; meId?: any; selectedUserId?: any
  width: number; height: number
  onSelectUserId?: (uid: any) => void; onBackgroundClick?: () => void
}) {
  const hostRef  = useRef<HTMLDivElement | null>(null)
  const gameRef  = useRef<any>(null)
  const stateRef = useRef<any>({ model: null, selectedUserId: null })
  const [loading, setLoading] = useState(true)

  const model = useMemo(() => {
    const seen = new Set<string>()
    const items = (Array.isArray(fleurs) ? fleurs : []).map((f, idx) => {
      const uid = f?.user_id ?? f?.id ?? idx
      return { uid, pseudo: String(f?.pseudo ?? ''), emoji: String(f?.avatar_emoji ?? ''),
               petals: scalePetals(f?.scores), isOnline: !!(f?.presence?.is_online ?? f?.is_online),
               isMe: meId != null && Number(uid) === Number(meId) }
    }).filter(x => {
      if (x.uid == null) return false
      const key = String(x.uid)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    const linkPairs = new Set<string>()
    ;(Array.isArray(links) ? links : []).forEach(l => {
      const ka = String(l?.user_a ?? ''), kb = String(l?.user_b ?? '')
      if (!ka || !kb || ka === kb) return
      linkPairs.add(ka < kb ? `${ka}-${kb}` : `${kb}-${ka}`)
    })
    return { items, linkPairs }
  }, [fleurs, links, meId])

  useEffect(() => { stateRef.current.model = model }, [model])
  useEffect(() => { stateRef.current.selectedUserId = selectedUserId ?? null }, [selectedUserId])

  /* Montage Phaser — une seule fois */
  useEffect(() => {
    if (!hostRef.current || gameRef.current) return
    let disposed = false
    ;(async () => {
      const Phaser = (await import('phaser')).default
      if (disposed || !hostRef.current || gameRef.current) return
      setLoading(false)

      const parent = hostRef.current
      const REPULSE = 12000, DAMPING = 0.80, GAP = 80
      const nodes: any[] = []
      const nodeMap = new Map<string, any>()  // O(1) lookup

      const config = {
        type: Phaser.AUTO, parent,
        audio: { noAudio: true }, transparent: true, backgroundColor: 0x00000000,
        scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH,
                 width: '100%', height: '100%', expandParent: false },
        scene: {
          preload() {},
          create() {
            const scene: any = this
            const W = () => scene.scale.width
            const H = () => scene.scale.height

            /* Fond onirique — forêt enchantée */
            const bgG      = scene.add.graphics().setScrollFactor(0).setDepth(0)
            const raysG    = scene.add.graphics().setScrollFactor(0).setDepth(1)
            const groundG  = scene.add.graphics().setScrollFactor(0).setDepth(2)
            const fogG     = scene.add.graphics().setScrollFactor(0).setDepth(3)
            const sparkleG = scene.add.graphics().setScrollFactor(0).setDepth(4)
            const sparkles: Array<{ x: number; y: number; size: number; phase: number; speed: number }> = []

            function redrawBg() {
              const w = W(), h = H()

              // Gradient forêt profonde (coins sombres → centre doré)
              bgG.clear()
              bgG.fillGradientStyle(0x052e16, 0x14532d, 0x052e16, 0x14532d, 1)
              bgG.fillRect(0, 0, w, h)
              // Halo de lumière dorée au centre (soleil filtrant)
              bgG.fillStyle(0xfef3c7, 0.10).fillEllipse(w * 0.5, h * 0.30, w * 0.80, h * 0.55)
              bgG.fillStyle(0xfde68a, 0.07).fillEllipse(w * 0.5, h * 0.22, w * 0.52, h * 0.38)

              // Rayons de lumière (fan depuis le haut)
              raysG.clear()
              const srcX = w * 0.50, srcY = -h * 0.05
              const nRays = 16, dist = Math.hypot(w, h) * 1.45
              for (let i = 0; i < nRays; i++) {
                const a1 = Math.PI * 0.12 + (i / nRays) * Math.PI * 0.76
                const a2 = Math.PI * 0.12 + ((i + 0.52) / nRays) * Math.PI * 0.76
                raysG.fillStyle(0xfef9c3, i % 4 === 0 ? 0.038 : 0.016)
                raysG.fillTriangle(
                  srcX, srcY,
                  srcX + Math.cos(a1) * dist, srcY + Math.sin(a1) * dist,
                  srcX + Math.cos(a2) * dist, srcY + Math.sin(a2) * dist,
                )
              }

              // Sol verdoyant
              groundG.clear()
              groundG.fillStyle(0x14532d, 0.45).fillEllipse(w * 0.5, h * 1.08, w * 1.6, h * 0.55)
              groundG.fillStyle(0x15803d, 0.35).fillEllipse(w * 0.5, h * 1.00, w * 1.3, h * 0.42)
              groundG.fillStyle(0x16a34a, 0.22).fillEllipse(w * 0.5, h * 0.93, w * 1.1, h * 0.30)
              // Étang
              groundG.fillStyle(0x0e7490, 0.32).fillEllipse(w * 0.50, h * 0.925, w * 0.60, h * 0.22)
              groundG.fillStyle(0x22d3ee, 0.16).fillEllipse(w * 0.50, h * 0.915, w * 0.52, h * 0.16)
              groundG.fillStyle(0x7dd3fc, 0.10).fillEllipse(w * 0.50, h * 0.910, w * 0.40, h * 0.10)
              // Nénuphars
              for (let i = 0; i < 10; i++) {
                const lx = w * 0.25 + (i / 9) * w * 0.50 + (i % 2 ? 14 : -10)
                const ly = h * (0.885 + (i % 3) * 0.023)
                const lr = 9 + (i % 3) * 7
                groundG.fillStyle(i % 2 ? 0x16a34a : 0x15803d, 0.65).fillEllipse(lx, ly, lr * 2, lr * 1.25)
                groundG.fillStyle(0xfda4af, 0.60).fillCircle(lx, ly, 2.5 + (i % 2) * 1.5)
              }

              // Brumes colorées multi-couches
              fogG.clear()
              fogG.fillStyle(0xd1fae5, 0.08).fillEllipse(w * 0.10, h * 0.58, w * 0.68, h * 0.46)
              fogG.fillStyle(0xfce7f3, 0.07).fillEllipse(w * 0.88, h * 0.52, w * 0.58, h * 0.40)
              fogG.fillStyle(0xfef9c3, 0.065).fillEllipse(w * 0.50, h * 0.20, w * 0.62, h * 0.32)
              fogG.fillStyle(0xe0f2fe, 0.06).fillEllipse(w * 0.50, h * 0.88, w * 1.00, h * 0.28)
              fogG.fillStyle(0xf0fdf4, 0.05).fillEllipse(w * 0.28, h * 0.40, w * 0.52, h * 0.32)
              fogG.fillStyle(0xfdf4ff, 0.045).fillEllipse(w * 0.76, h * 0.70, w * 0.42, h * 0.30)
              fogG.fillStyle(0xfef3c7, 0.04).fillEllipse(w * 0.50, h * 0.60, w * 0.70, h * 0.50)

              // Positions des étincelles (recalcul à chaque resize)
              sparkles.length = 0
              const nSp = clamp(Math.floor(w * h / 5500), 45, 140)
              for (let i = 0; i < nSp; i++) {
                sparkles.push({
                  x: Math.random() * w,
                  y: Math.random() * h * 0.90,
                  size: 1.2 + Math.random() * 2.4,
                  phase: Math.random() * Math.PI * 2,
                  speed: 0.4 + Math.random() * 2.0,
                })
              }
            }
            redrawBg()
            scene.scale.on('resize', redrawBg)

            /* Caméra */
            const cam = scene.cameras.main

            /* Pan (sur espace vide uniquement) */
            let panning = false, panStart = { px: 0, py: 0, sx: 0, sy: 0 }
            let panMoved = false

            scene.input.on('pointerdown', (p: any) => {
              if (stateRef.current.__dragNode) return
              panning = true; panMoved = false
              panStart = { px: p.x, py: p.y, sx: cam.scrollX, sy: cam.scrollY }
            })
            scene.input.on('pointermove', (p: any) => {
              if (!panning || stateRef.current.__dragNode) return
              const dx = p.x - panStart.px, dy = p.y - panStart.py
              if (Math.abs(dx) + Math.abs(dy) > 5) {
                panMoved = true
                cam.scrollX = panStart.sx - dx / cam.zoom
                cam.scrollY = panStart.sy - dy / cam.zoom
              }
            })
            scene.input.on('pointerup', () => {
              if (panning && !panMoved && !stateRef.current.__clickedNode) onBackgroundClick?.()
              panning = false
              stateRef.current.__clickedNode = false
            })
            scene.input.on('wheel', (_p: any, _g: any, _dx: number, dy: number) => {
              cam.zoom = clamp(cam.zoom * (dy > 0 ? 0.91 : 1.09), 0.35, 2.5)
            })

            /* Liens */
            const linkG = scene.add.graphics().setDepth(6)

            /* Créer un nœud */
            function addNode(it: any) {
              if (nodeMap.has(String(it.uid))) return   // sécurité anti-doublon
              const cx = W() / 2, cy = H() / 2
              const n = (stateRef.current.model ?? model).items.length
              const seed = hash01(String(it.uid))
              const angle = (nodes.length / Math.max(n, 1)) * Math.PI * 2 + seed * 0.5
              const ring = Math.max((n * GAP) / (2 * Math.PI), Math.min(W(), H()) * 0.30)
              const jit = (hash01(String(it.uid) + ':j') - 0.5) * 0.15
              const r = ring * (1 + jit)
              const x = cx + Math.cos(angle) * r, y = cy + Math.sin(angle) * r
              const hitR = it.isMe ? 30 : 26

              // Coordonnées locales : tout le groupe suit le Container (évite label « fantôme » décollé)
              const haloG = scene.add.graphics()
              const haloCol = it.isMe ? 0xfbbf24 : it.isOnline ? 0x4ade80 : 0x94a3b8
              haloG.fillStyle(haloCol, it.isMe ? 0.28 : 0.16)
              haloG.fillEllipse(0, 10, it.isMe ? 52 : 40, it.isMe ? 18 : 13)

              const flowerG = scene.add.graphics()
              drawFlower(flowerG, it.petals, it.isMe, false)

              const labelText = (it.pseudo + (it.emoji ? ' ' + it.emoji : '')).trim() || 'Fleur'
              const label = scene.add.text(0, hitR + 4, labelText, {
                fontFamily: 'system-ui, sans-serif', fontSize: it.isMe ? '13px' : '11px',
                color: '#1a3a1a', backgroundColor: 'rgba(254,243,199,0.78)',
                padding: { left: 7, right: 7, top: 3, bottom: 3 }, resolution: 2,
              }).setOrigin(0.5, 0)

              const nodeC = scene.add.container(x, y, [haloG, flowerG, label]).setDepth(8)

              /* Zone interactive + draggable (monde = même centre que le container) */
              const hitZone = scene.add
                .zone(x, y, hitR * 2.2, hitR * 2.2)
                .setInteractive({ draggable: !it.isMe, useHandCursor: !it.isMe })
                .setDepth(12)

              hitZone.on('pointerdown', () => {
                stateRef.current.__clickedNode = true
                panning = false
              })
              hitZone.on('pointerup', () => {
                if (!stateRef.current.__dragNode) {
                  if (!it.isMe) onSelectUserId?.(it.uid)
                }
              })

              if (!it.isMe) {
                hitZone.on('dragstart', () => {
                  stateRef.current.__dragNode = String(it.uid)
                  panning = false
                })
                hitZone.on('drag', (_p: any, dragX: number, dragY: number) => {
                  const nd = nodeMap.get(String(it.uid))
                  if (!nd) return
                  nd.x = dragX; nd.y = dragY
                  nd.vx = 0; nd.vy = 0
                  nd.container.setPosition(dragX, dragY)
                  nd.hitZone.setPosition(dragX, dragY)
                })
                hitZone.on('dragend', () => {
                  stateRef.current.__dragNode = null
                })
              }

              const nd = { uid: it.uid, it, container: nodeC, flowerG, haloG, hitZone, label, hitR,
                            x, y, vx: 0, vy: 0, _wasSelected: false }
              nodes.push(nd)
              nodeMap.set(String(it.uid), nd)
            }

            // Créer tous les nœuds
            ;(stateRef.current.model ?? model).items.forEach(addNode)

            /* Boucle physique + rendu — throttlée */
            let physTick = 0
            scene.events.on('update', (time: number) => {
              physTick++
              const st  = stateRef.current
              const sel = st.selectedUserId
              const m   = st.model ?? model
              const ww  = W(), hh = H()

              /* Étincelles animées */
              sparkleG.clear()
              const t = time * 0.001
              for (const sp of sparkles) {
                const a = 0.15 + 0.70 * (0.5 + 0.5 * Math.sin(sp.phase + t * sp.speed))
                if (a < 0.07) continue
                sparkleG.fillStyle(0xffffff, a)
                const arm = sp.size * 2.8, thin = sp.size * 0.28
                sparkleG.fillRect(sp.x - arm, sp.y - thin, arm * 2, thin * 2)  // horizontal
                sparkleG.fillRect(sp.x - thin, sp.y - arm, thin * 2, arm * 2)  // vertical
                sparkleG.fillCircle(sp.x, sp.y, sp.size * 0.45)
              }

              /* Liens — couleurs forêt */
              linkG.clear()
              ;(m?.linkPairs ?? model.linkPairs).forEach((key: string) => {
                const [a, b] = key.split('-')
                const na = nodeMap.get(a), nb = nodeMap.get(b)
                if (!na || !nb) return
                const focused = sel != null &&
                  (String(na.uid) === String(sel) || String(nb.uid) === String(sel))
                linkG.lineStyle(focused ? 2.5 : 1.2, focused ? 0xd946ef : 0x4ade80, focused ? 0.65 : 0.28)
                linkG.lineBetween(na.x, na.y, nb.x, nb.y)
              })

              /* Physique — 1 frame sur 2 */
              if (physTick % 2 === 0) {
                const cx = ww / 2, cy = hh / 2
                const targetR = Math.max((nodes.length * GAP) / (2 * Math.PI), Math.min(ww, hh) * 0.30)

                for (let i = 0; i < nodes.length; i++) {
                  const a = nodes[i]
                  if (st.__dragNode === String(a.uid)) continue

                  // Rappel vers anneau
                  const dxc = cx - a.x, dyc = cy - a.y
                  const dc  = Math.sqrt(dxc * dxc + dyc * dyc) + 0.01
                  const err = (dc - targetR) / (targetR + 1)
                  a.vx += (dxc / dc) * err * 0.018
                  a.vy += (dyc / dc) * err * 0.018

                  // Répulsion pairwise
                  for (let j = i + 1; j < nodes.length; j++) {
                    const b = nodes[j]
                    const dx = a.x - b.x, dy = a.y - b.y
                    const d2 = dx * dx + dy * dy + 1
                    const d  = Math.sqrt(d2), inv = 1 / d
                    const f  = Math.min(0.10, REPULSE / (d2 + 1200)) * 0.001
                    a.vx += dx * inv * f; a.vy += dy * inv * f
                    b.vx -= dx * inv * f; b.vy -= dy * inv * f
                    const minD = a.hitR + b.hitR + 18
                    if (d < minD) {
                      const push = ((minD - d) / minD) * 0.32
                      a.vx += dx * inv * push; a.vy += dy * inv * push
                      b.vx -= dx * inv * push; b.vy -= dy * inv * push
                    }
                  }

                  a.vx *= DAMPING; a.vy *= DAMPING
                  a.x = clamp(a.x + a.vx, 40, ww - 40)
                  a.y = clamp(a.y + a.vy, 40, hh - 40)
                }
              }

              /* Sync positions + sélection */
              for (const nd of nodes) {
                if (st.__dragNode === String(nd.uid)) continue
                nd.container.setPosition(nd.x, nd.y)
                nd.hitZone.setPosition(nd.x, nd.y)
                // Redessiner seulement si sélection change
                const selected = sel != null && Number(nd.uid) === Number(sel)
                if (nd._wasSelected !== selected) {
                  nd._wasSelected = selected
                  drawFlower(nd.flowerG, nd.it.petals, nd.it.isMe, selected)
                  nd.haloG.clear()
                  const hc = nd.it.isMe ? 0xfbbf24 : nd.it.isOnline ? 0x4ade80 : 0x94a3b8
                  const ellA = selected ? 0.45 : nd.it.isMe ? 0.28 : 0.16
                  nd.haloG.fillStyle(hc, ellA)
                  nd.haloG.fillEllipse(0, 10, nd.it.isMe ? 52 : 40, nd.it.isMe ? 18 : 13)
                  // Anneau de sélection visible autour de la fleur (pas un disque plein)
                  if (selected) {
                    nd.haloG.lineStyle(2.5, hc, 0.75)
                    nd.haloG.strokeCircle(0, 0, nd.it.isMe ? 32 : 26)
                  }
                  nd.label.setAlpha(selected ? 1 : 0.82)
                  nd.flowerG.setScale(selected ? 1.1 : 1)
                }
              }
            })

            stateRef.current = { ...stateRef.current, scene, nodes, nodeMap, __dragNode: null, __clickedNode: false }
          },
        },
      }

      gameRef.current = new Phaser.Game(config as any)
    })()

    return () => {
      disposed = true
      const g = gameRef.current; gameRef.current = null
      stateRef.current = { model: null, selectedUserId: null }
      try { g?.destroy?.(true) } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="absolute inset-0" style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/85 z-20">
          <span className="w-10 h-10 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
          <span className="text-xs text-slate-400">Chargement du jardin…</span>
        </div>
      )}
      <div ref={hostRef} className="absolute inset-0" style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
