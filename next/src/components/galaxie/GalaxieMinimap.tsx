'use client'

import type { MouseEvent } from 'react'

type GalaxieMinimapProps = {
  width: number
  height: number
  graphW: number
  graphH: number
  nodes: Array<{ id: string; x?: number; y?: number; isMe?: boolean }>
  zoom: number
  panX: number
  panY: number
  onNavigate?: (gx: number, gy: number) => void
}

export function GalaxieMinimap({
  width,
  height,
  graphW,
  graphH,
  nodes,
  zoom,
  panX,
  panY,
  onNavigate,
}: GalaxieMinimapProps) {
  const mapW = 108
  const mapH = 72
  const pad = 6
  const cx = graphW / 2
  const cy = graphH / 2
  const scale = Math.min((mapW - pad * 2) / graphW, (mapH - pad * 2) / graphH)

  const toMap = (gx: number, gy: number) => ({
    x: pad + (gx / graphW) * (mapW - pad * 2),
    y: pad + (gy / graphH) * (mapH - pad * 2),
  })

  // Viewport rectangle in graph coords (approx inverse of graph2ScreenCoords)
  const viewW = width / zoom
  const viewH = height / zoom
  const viewCx = (width / 2 - panX) / zoom
  const viewCy = (height / 2 - panY) / zoom
  const vp = {
    x: viewCx - viewW / 2,
    y: viewCy - viewH / 2,
    w: viewW,
    h: viewH,
  }
  const vpMap = {
    x: pad + (vp.x / graphW) * (mapW - pad * 2),
    y: pad + (vp.y / graphH) * (mapH - pad * 2),
    w: (vp.w / graphW) * (mapW - pad * 2),
    h: (vp.h / graphH) * (mapH - pad * 2),
  }

  const handleClick = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const gx = ((mx - pad) / (mapW - pad * 2)) * graphW
    const gy = ((my - pad) / (mapH - pad * 2)) * graphH
    if (gx >= 0 && gy >= 0 && gx <= graphW && gy <= graphH) {
      onNavigate?.(gx, gy)
    }
  }

  return (
    <svg
      width={mapW}
      height={mapH}
      className="rounded-lg border border-slate-600/50 bg-slate-950/82 backdrop-blur-md shadow-lg cursor-crosshair"
      onClick={handleClick}
      role="navigation"
      aria-label="Minimap"
    >
      <rect x={0} y={0} width={mapW} height={mapH} fill="rgba(2,6,23,0.55)" rx={8} />
      <circle cx={toMap(cx, cy).x} cy={toMap(cx, cy).y} r={2} fill="rgba(251,191,36,0.35)" />
      {nodes.map((n) => {
        if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) return null
        const p = toMap(n.x!, n.y!)
        return (
          <circle
            key={n.id}
            cx={p.x}
            cy={p.y}
            r={n.isMe ? 2.2 : 1.2}
            fill={n.isMe ? 'rgba(251,191,36,0.95)' : 'rgba(34,211,238,0.65)'}
          />
        )
      })}
      <rect
        x={Math.max(pad, Math.min(vpMap.x, mapW - pad - 4))}
        y={Math.max(pad, Math.min(vpMap.y, mapH - pad - 4))}
        width={Math.max(8, Math.min(vpMap.w, mapW - pad * 2))}
        height={Math.max(6, Math.min(vpMap.h, mapH - pad * 2))}
        fill="none"
        stroke="rgba(250,204,21,0.75)"
        strokeWidth={1}
        rx={2}
      />
    </svg>
  )
}
