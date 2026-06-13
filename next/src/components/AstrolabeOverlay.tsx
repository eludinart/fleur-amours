'use client'

import { useMemo, useState } from 'react'
import { t } from '@/i18n'

export type AstrolabeFilterAction =
  | { type: 'petal'; petalId: string }
  | { type: 'filter'; mode: 'all' | 'contacts' | 'online' | 'neighborhood' }
  | { type: 'clear' }

type AstrolabeOverlayProps = {
  width: number
  height: number
  className?: string
  /** full = grille riche ; organic = constellation discrète (direction C) */
  variant?: 'full' | 'organic'
  model?: {
    ecosystemHealth: number
    synergyCore: number
    permacultureFlows: number
    fleursCount: number
    ecosystemCount?: number
    linksCount: number
    myLinksCount?: number
    ecoLinksCount?: number
    onlineCount: number
    pointsDeRosee: number
    dominantPetal: string
    dominantPetalName?: string
    myDominantPetal?: string
    myDominantPetalName?: string
    meanPetalScore?: number
    names: string[]
  }
  activePetalFilter?: string
  activeFilterMode?: string
  onFilterAction?: (action: AstrolabeFilterAction) => void
}

const PETAL_SECTORS = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros']
const PETAL_COLORS: Record<string, string> = {
  agape: 'rgba(255,107,138,0.20)',
  philautia: 'rgba(245,158,11,0.20)',
  mania: 'rgba(255,96,48,0.20)',
  storge: 'rgba(45,212,191,0.18)',
  pragma: 'rgba(129,140,248,0.20)',
  philia: 'rgba(52,211,153,0.18)',
  ludus: 'rgba(56,189,248,0.20)',
  eros: 'rgba(192,132,252,0.20)',
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= maxCharsPerLine) { current = next; continue }
    if (current) lines.push(current)
    current = word
  }
  if (current) lines.push(current)
  return lines
}

export function AstrolabeOverlay({
  width,
  height,
  className = 'z-10',
  variant = 'full',
  model,
  activePetalFilter = '',
  activeFilterMode = 'all',
  onFilterAction,
}: AstrolabeOverlayProps) {
  const [activeDialIdx, setActiveDialIdx] = useState<number | null>(null)
  const center = useMemo(() => ({ x: width / 2, y: height / 2 }), [width, height])
  const OUTER_RING_FACTOR = 2.04
  const PETAL_LABEL_FACTOR = 1.9
  const safeHalf = Math.min((width - 44) / 2, (height - 92) / 2)
  const maxFromOuterRings = safeHalf / OUTER_RING_FACTOR
  const baseR = Math.max(96, Math.min(Math.min(width, height) * 0.22, maxFromOuterRings))
  const organic = variant === 'organic'
  const rings = organic ? [0.85, 1.2, 1.65] : [0.56, 0.72, 0.9, 1.08, 1.28, 1.52, 1.78, 2.04]
  const axisCount = organic ? 8 : 24

  const dialVars = useMemo(() => ({
    count: model?.ecosystemCount ?? model?.fleursCount ?? 0,
    total: model?.fleursCount ?? 0,
    links: model?.myLinksCount ?? model?.linksCount ?? 0,
    ecoLinks: model?.ecoLinksCount ?? model?.linksCount ?? 0,
    online: model?.onlineCount ?? 0,
    avg: model?.meanPetalScore ?? 0,
    pct: Math.round(model?.ecosystemHealth ?? 0),
    petal: model?.dominantPetalName ?? (model?.dominantPetal ?? 'agape'),
    myPetal: model?.myDominantPetalName ?? (model?.myDominantPetal ?? '—'),
  }), [model])

  const dialEntries = useMemo(() => [
    {
      id: 'health',
      label: t('prairie.dialHealth'),
      value: `${Math.round(model?.ecosystemHealth ?? 0)}%`,
      detail: t('prairie.dialHealthDetail', dialVars),
      description: t('prairie.dialHealthDesc'),
      longDesc: t('prairie.dialHealthLong', dialVars),
      x: 78,
      y: 78,
      r: 56,
      action: { type: 'clear' } as AstrolabeFilterAction,
    },
    {
      id: 'synergy',
      label: t('prairie.dialSynergy'),
      value: `${Math.round(model?.synergyCore ?? 0)}%`,
      detail: t('prairie.dialSynergyDetail', dialVars),
      description: t('prairie.dialSynergyDesc'),
      longDesc: t('prairie.dialSynergyLong', dialVars),
      x: -78,
      y: 78,
      r: 52,
      action: { type: 'filter', mode: 'contacts' } as AstrolabeFilterAction,
    },
    {
      id: 'flows',
      label: t('prairie.dialFlows'),
      value: `${Math.round(model?.permacultureFlows ?? 0)}%`,
      detail: t('prairie.dialFlowsDetail', dialVars),
      description: t('prairie.dialFlowsDesc'),
      longDesc: t('prairie.dialFlowsLong', dialVars),
      x: 78,
      y: -78,
      r: 58,
      action: { type: 'filter', mode: 'online' } as AstrolabeFilterAction,
    },
    {
      id: 'dominant',
      label: t('prairie.dialDominant'),
      value: String(dialVars.petal),
      detail: t('prairie.dialDominantDetail', dialVars),
      description: t('prairie.dialDominantDesc'),
      longDesc: t('prairie.dialDominantLong', dialVars),
      x: -78,
      y: -78,
      r: 50,
      action: { type: 'petal', petalId: model?.dominantPetal ?? 'agape' } as AstrolabeFilterAction,
    },
  ], [model, dialVars])

  const handleDialClick = (idx: number) => {
    setActiveDialIdx((prev) => (prev === idx ? null : idx))
    const dial = dialEntries[idx]
    if (dial?.action) onFilterAction?.(dial.action)
  }

  const scopeLines = wrapText(t('prairie.dialEcosystemScope', dialVars), 42)

  return (
    <svg
      className={`absolute inset-0 w-full h-full ${className}`}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={t('prairie.astrolabeLabel')}
      style={{ pointerEvents: 'none' }}
    >
      <defs>
        <radialGradient id="astrolabeCore" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={organic ? 'rgba(253,230,138,0.08)' : 'rgba(253,230,138,0.20)'} />
          <stop offset="55%" stopColor={organic ? 'rgba(234,179,8,0.03)' : 'rgba(234,179,8,0.07)'} />
          <stop offset="100%" stopColor="rgba(15,23,42,0)" />
        </radialGradient>
        <filter id="softGlow">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x="0" y="0" width={width} height={height} fill="url(#astrolabeCore)" pointerEvents="none" />

      {rings.map((factor, idx) => (
        <circle
          key={`ring-${idx}`}
          cx={center.x}
          cy={center.y}
          r={baseR * factor}
          fill="none"
          stroke={organic ? 'rgba(251,191,36,0.10)' : (idx % 2 === 0 ? 'rgba(251,191,36,0.30)' : 'rgba(251,191,36,0.18)')}
          strokeWidth={organic ? 0.55 : (idx % 3 === 0 ? 1.1 : 0.8)}
          filter={organic ? undefined : 'url(#softGlow)'}
          pointerEvents="none"
        />
      ))}

      {Array.from({ length: axisCount }).map((_, idx) => {
        const a = (idx / axisCount) * Math.PI * 2
        return (
          <line
            key={`axis-${idx}`}
            x1={center.x}
            y1={center.y}
            x2={center.x + Math.cos(a) * baseR * (organic ? 1.55 : 2.08)}
            y2={center.y + Math.sin(a) * baseR * (organic ? 1.55 : 2.08)}
            stroke={organic ? 'rgba(250,204,21,0.06)' : 'rgba(250,204,21,0.14)'}
            strokeWidth={organic ? 0.45 : (idx % 3 === 0 ? 0.95 : 0.55)}
            pointerEvents="none"
          />
        )
      })}

      {!organic && PETAL_SECTORS.map((petal, idx) => {
        const a = ((idx / PETAL_SECTORS.length) * Math.PI * 2) - Math.PI / 2
        const cx = center.x + Math.cos(a) * baseR * 0.78
        const cy = center.y + Math.sin(a) * baseR * 0.78
        const isActive = activePetalFilter === petal
        return (
          <g
            key={`petal-shape-${petal}`}
            transform={`translate(${cx},${cy}) rotate(${(a * 180) / Math.PI + 90})`}
            style={{ cursor: onFilterAction ? 'pointer' : 'default', pointerEvents: 'all' }}
            onClick={() => onFilterAction?.({ type: 'petal', petalId: petal })}
            role="button"
            aria-label={petal}
          >
            <ellipse
              cx="0"
              cy="0"
              rx={baseR * 0.11}
              ry={baseR * 0.24}
              fill={isActive ? 'rgba(252,211,77,0.35)' : (PETAL_COLORS[petal] ?? 'rgba(253,224,71,0.2)')}
              stroke={isActive ? 'rgba(253,224,71,0.75)' : 'rgba(252,211,77,0.34)'}
              strokeWidth={isActive ? 1.4 : 0.9}
            />
          </g>
        )
      })}

      <circle cx={center.x} cy={center.y} r={baseR * 0.18} fill={organic ? 'rgba(255,244,214,0.05)' : 'rgba(255,244,214,0.14)'} stroke={organic ? 'rgba(253,224,71,0.15)' : 'rgba(253,224,71,0.40)'} strokeWidth={organic ? 0.6 : 1} pointerEvents="none" />

      {PETAL_SECTORS.map((petal, idx) => {
        const a = ((idx / PETAL_SECTORS.length) * Math.PI * 2) - Math.PI / 2
        const x = center.x + Math.cos(a) * baseR * (organic ? 1.55 : PETAL_LABEL_FACTOR)
        const y = center.y + Math.sin(a) * baseR * (organic ? 1.55 : PETAL_LABEL_FACTOR)
        const isActive = activePetalFilter === petal
        return (
          <text
            key={`petal-label-${petal}`}
            x={x}
            y={y}
            textAnchor="middle"
            fill={isActive ? 'rgba(254,240,138,0.95)' : (organic ? 'rgba(253,224,71,0.38)' : 'rgba(253,224,71,0.66)')}
            style={{ fontSize: organic ? 9 : 10, letterSpacing: '0.06em', fontFamily: 'serif', cursor: onFilterAction ? 'pointer' : 'default', pointerEvents: 'all' }}
            onClick={() => onFilterAction?.({ type: 'petal', petalId: petal })}
          >
            {petal.toUpperCase()}
          </text>
        )
      })}

      {/* Périmètre : indicateurs de ton écosystème */}
      {dialEntries.map((dial, idx) => {
        const x = dial.x > 0 ? width - dial.x : -dial.x
        const y = dial.y > 0 ? dial.y : height + dial.y
        const isActive = activeDialIdx === idx
        const isFilterActive =
          (dial.id === 'synergy' && activeFilterMode === 'contacts') ||
          (dial.id === 'flows' && activeFilterMode === 'online') ||
          (dial.id === 'dominant' && activePetalFilter === model?.dominantPetal)
        const detailLines = wrapText(dial.detail, 22)
        const longLines = wrapText(dial.longDesc, 36)
        const detailStartY = dial.r + 18
        const labelY = detailStartY + detailLines.length * 11 + 6
        const panelWidth = 188
        const panelHeight = 28 + longLines.length * 13 + 36
        return (
          <g
            key={`dial-${idx}`}
            transform={`translate(${x},${y})`}
            onMouseEnter={() => setActiveDialIdx(idx)}
            onMouseLeave={() => setActiveDialIdx((prev) => (prev === idx ? null : prev))}
            onClick={() => handleDialClick(idx)}
            style={{ cursor: 'pointer', pointerEvents: 'all' }}
            role="button"
            aria-pressed={isFilterActive}
            aria-label={`${dial.label}: ${dial.value}. ${dial.detail}`}
          >
            <circle r={dial.r} fill={isFilterActive ? 'rgba(252,211,77,0.14)' : 'rgba(8,20,45,0.28)'} stroke={isFilterActive ? 'rgba(252,211,77,0.70)' : 'rgba(245,158,11,0.50)'} strokeWidth="1.1" />
            <circle r={dial.r * 0.72} fill="none" stroke="rgba(252,211,77,0.32)" strokeWidth="0.9" />
            <text x="0" y={dial.id === 'dominant' ? 4 : 5} textAnchor="middle" fill="rgba(254,240,138,0.92)" style={{ fontSize: dial.id === 'dominant' ? 11 : 13, fontWeight: 700, fontFamily: dial.id === 'dominant' ? 'serif' : 'ui-monospace, monospace', pointerEvents: 'none' }}>
              {dial.value}
            </text>
            {dial.id === 'health' && (
              <text x="0" y="-14" textAnchor="middle" fill="rgba(148,163,184,0.85)" style={{ fontSize: 7, fontFamily: 'sans-serif', pointerEvents: 'none' }}>
                {dial.description}
              </text>
            )}
            {detailLines.map((line, lineIdx) => (
              <text
                key={`detail-${idx}-${lineIdx}`}
                x="0"
                y={detailStartY + lineIdx * 11}
                textAnchor="middle"
                fill="rgba(203,213,225,0.88)"
                style={{ fontSize: 7.5, fontFamily: 'sans-serif', pointerEvents: 'none' }}
              >
                {line}
              </text>
            ))}
            <text x="0" y={labelY} textAnchor="middle" fill="rgba(252,211,77,0.78)" style={{ fontSize: 9.5, letterSpacing: '0.03em', fontWeight: 600, fontFamily: 'serif', pointerEvents: 'none' }}>
              {dial.label}
            </text>
            {isActive && (
              <g transform={`translate(${dial.x > 0 ? -(dial.r + panelWidth + 8) : dial.r + 10},${-(dial.r * 0.55)})`} pointerEvents="none">
                <rect x="0" y="0" rx="10" ry="10" width={panelWidth} height={panelHeight} fill="rgba(8,20,45,0.94)" stroke="rgba(252,211,77,0.58)" strokeWidth="1" />
                <text x="12" y="18" fill="rgba(254,240,138,0.96)" style={{ fontSize: 11, fontWeight: 700, fontFamily: 'serif' }}>{dial.label}</text>
                <text x="12" y="34" fill="rgba(148,163,184,0.95)" style={{ fontSize: 8.5, fontFamily: 'sans-serif' }}>{dial.description}</text>
                <text x="12" y="52" fill="rgba(255,255,255,0.92)" style={{ fontSize: 9.5, fontFamily: 'sans-serif' }}>
                  {longLines.map((line, lineIdx) => (
                    <tspan key={`long-${idx}-${lineIdx}`} x="12" dy={lineIdx === 0 ? 0 : 13}>{line}</tspan>
                  ))}
                </text>
                <text x="12" y={panelHeight - 14} fill="rgba(52,211,153,0.92)" style={{ fontSize: 8.5, fontFamily: 'sans-serif' }}>
                  {t('prairie.dialClickHint')}
                </text>
              </g>
            )}
          </g>
        )
      })}

      {/* Légende centrale bas : périmètre des indicateurs */}
      <g transform={`translate(${center.x},${height - 28})`} pointerEvents="none">
        <text x="0" y="0" textAnchor="middle" fill="rgba(148,163,184,0.82)" style={{ fontSize: 8.5, fontFamily: 'sans-serif' }}>
          {scopeLines.map((line, lineIdx) => (
            <tspan key={`scope-${lineIdx}`} x="0" dy={lineIdx === 0 ? 0 : 11}>{line}</tspan>
          ))}
        </text>
      </g>
    </svg>
  )
}
