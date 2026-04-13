'use client'

import { useMemo, useState } from 'react'

type AstrolabeOverlayProps = {
  width: number
  height: number
  model?: {
    ecosystemHealth: number
    synergyCore: number
    permacultureFlows: number
    fleursCount: number
    linksCount: number
    onlineCount: number
    pointsDeRosee: number
    dominantPetal: string
    names: string[]
  }
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
    if (next.length <= maxCharsPerLine) {
      current = next
      continue
    }
    if (current) lines.push(current)
    current = word
  }
  if (current) lines.push(current)
  return lines
}

export function AstrolabeOverlay({ width, height, model }: AstrolabeOverlayProps) {
  const [activeDialIdx, setActiveDialIdx] = useState<number | null>(null)
  const center = useMemo(() => ({ x: width / 2, y: height / 2 }), [width, height])
  const OUTER_RING_FACTOR = 2.04
  const PETAL_LABEL_FACTOR = 1.9
  const safeHalf = Math.min((width - 44) / 2, (height - 92) / 2)
  const maxFromOuterRings = safeHalf / OUTER_RING_FACTOR
  const baseR = Math.max(96, Math.min(Math.min(width, height) * 0.22, maxFromOuterRings))
  const rings = [0.56, 0.72, 0.9, 1.08, 1.28, 1.52, 1.78, 2.04]
  const dialEntries = [
    {
      label: 'Ecosystem Health Index',
      value: `${Math.round(model?.ecosystemHealth ?? 0)}%`,
      description:
        "Niveau global de vitalite du Grand Jardin: il combine l'equilibre moyen des 8 petales sur l'ensemble des fleurs visibles.",
      x: 78,
      y: 78,
      r: 56,
    },
    {
      label: 'Synergy Core',
      value: `${Math.round(model?.synergyCore ?? 0)}%`,
      description:
        'Intensite relationnelle du reseau: plus les liens effectifs entre utilisateurs sont nombreux et actifs, plus ce coeur de synergie monte.',
      x: -78,
      y: 78,
      r: 52,
    },
    {
      label: 'Permaculture Flows',
      value: `${Math.round(model?.permacultureFlows ?? 0)}%`,
      description:
        'Qualite des flux vivants du systeme: presence en ligne, circulation des interactions et capacite du jardin a rester dynamique dans le temps.',
      x: 78,
      y: -78,
      r: 58,
    },
    {
      label: 'Dominant Petal',
      value: (model?.dominantPetal ?? 'agape').toUpperCase(),
      description:
        "Petale actuellement dominant dans le paysage collectif. Il represente la tonalite relationnelle la plus forte du moment.",
      x: -78,
      y: -78,
      r: 50,
    },
  ]

  return (
    <svg
      className="absolute inset-0 w-full h-full z-10"
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      style={{ pointerEvents: 'none' }}
    >
      <defs>
        <radialGradient id="astrolabeCore" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(253,230,138,0.20)" />
          <stop offset="55%" stopColor="rgba(234,179,8,0.07)" />
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

      <rect x="0" y="0" width={width} height={height} fill="url(#astrolabeCore)" />

      {rings.map((factor, idx) => (
        <circle
          key={`ring-${idx}`}
          cx={center.x}
          cy={center.y}
          r={baseR * factor}
          fill="none"
          stroke={idx % 2 === 0 ? 'rgba(251,191,36,0.30)' : 'rgba(251,191,36,0.18)'}
          strokeWidth={idx % 3 === 0 ? 1.1 : 0.8}
          filter="url(#softGlow)"
        />
      ))}

      {Array.from({ length: 24 }).map((_, idx) => {
        const a = (idx / 24) * Math.PI * 2
        const x2 = center.x + Math.cos(a) * baseR * 2.08
        const y2 = center.y + Math.sin(a) * baseR * 2.08
        return (
          <line
            key={`axis-${idx}`}
            x1={center.x}
            y1={center.y}
            x2={x2}
            y2={y2}
            stroke="rgba(250,204,21,0.14)"
            strokeWidth={idx % 3 === 0 ? 0.95 : 0.55}
          />
        )
      })}

      {Array.from({ length: 96 }).map((_, idx) => {
        const a = (idx / 96) * Math.PI * 2
        const r1 = baseR * 1.95
        const r2 = idx % 4 === 0 ? baseR * 2.03 : baseR * 1.99
        const x1 = center.x + Math.cos(a) * r1
        const y1 = center.y + Math.sin(a) * r1
        const x2 = center.x + Math.cos(a) * r2
        const y2 = center.y + Math.sin(a) * r2
        return (
          <line
            key={`tick-${idx}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="rgba(253,224,71,0.34)"
            strokeWidth={idx % 8 === 0 ? 1 : 0.5}
          />
        )
      })}

      {/* Couronne des 8 pétales de la Fleur d'Amour (sémantique produit) */}
      {PETAL_SECTORS.map((petal, idx) => {
        const a = ((idx / PETAL_SECTORS.length) * Math.PI * 2) - Math.PI / 2
        const cx = center.x + Math.cos(a) * baseR * 0.78
        const cy = center.y + Math.sin(a) * baseR * 0.78
        return (
          <g key={`petal-shape-${petal}`} transform={`translate(${cx},${cy}) rotate(${(a * 180) / Math.PI + 90})`}>
            <ellipse
              cx="0"
              cy="0"
              rx={baseR * 0.11}
              ry={baseR * 0.24}
              fill={PETAL_COLORS[petal] ?? 'rgba(253,224,71,0.2)'}
              stroke="rgba(252,211,77,0.34)"
              strokeWidth="0.9"
            />
          </g>
        )
      })}
      <circle
        cx={center.x}
        cy={center.y}
        r={baseR * 0.18}
        fill="rgba(255,244,214,0.14)"
        stroke="rgba(253,224,71,0.40)"
        strokeWidth="1"
      />

      {PETAL_SECTORS.map((petal, idx) => {
        const a = ((idx / PETAL_SECTORS.length) * Math.PI * 2) - Math.PI / 2
        const x = center.x + Math.cos(a) * baseR * PETAL_LABEL_FACTOR
        const y = center.y + Math.sin(a) * baseR * PETAL_LABEL_FACTOR
        return (
          <text
            key={`petal-${petal}`}
            x={x}
            y={y}
            textAnchor="middle"
            fill="rgba(253,224,71,0.66)"
            style={{ fontSize: 10, letterSpacing: '0.06em', fontFamily: 'serif' }}
          >
            {petal.toUpperCase()}
          </text>
        )
      })}

      {dialEntries.map((dial, idx) => {
        const x = dial.x > 0 ? width - dial.x : -dial.x
        const y = dial.y > 0 ? dial.y : height + dial.y
        const isActive = activeDialIdx === idx
        const descLines = wrapText(dial.description, 34)
        const descTop = 38
        const descLineHeight = 14
        const valueY = descTop + descLines.length * descLineHeight + 16
        const boxHeight = Math.max(98, valueY + 14)
        return (
          <g
            key={`dial-${idx}`}
            transform={`translate(${x},${y})`}
            onMouseEnter={() => setActiveDialIdx(idx)}
            onMouseLeave={() => setActiveDialIdx((prev) => (prev === idx ? null : prev))}
            onClick={() => setActiveDialIdx((prev) => (prev === idx ? null : idx))}
            style={{ cursor: 'pointer', pointerEvents: 'all' }}
          >
            <circle r={dial.r} fill="rgba(8,20,45,0.20)" stroke="rgba(245,158,11,0.45)" strokeWidth="1" />
            <circle r={dial.r * 0.72} fill="none" stroke="rgba(252,211,77,0.30)" strokeWidth="0.9" />
            {Array.from({ length: 18 }).map((__, t) => {
              const a = (t / 18) * Math.PI * 2
              const x1 = Math.cos(a) * dial.r * 0.78
              const y1 = Math.sin(a) * dial.r * 0.78
              const x2 = Math.cos(a) * dial.r * 0.98
              const y2 = Math.sin(a) * dial.r * 0.98
              return (
                <line
                  key={`dial-tick-${idx}-${t}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="rgba(253,224,71,0.30)"
                  strokeWidth={t % 3 === 0 ? 1 : 0.55}
                />
              )
            })}
            <text
              x="0"
              y={dial.r + 16}
              textAnchor="middle"
              fill="rgba(252,211,77,0.70)"
              style={{ fontSize: 10, letterSpacing: '0.04em', fontFamily: 'serif' }}
            >
              {dial.label}
            </text>
            <text
              x="0"
              y={5}
              textAnchor="middle"
              fill="rgba(254,240,138,0.88)"
              style={{ fontSize: 12, letterSpacing: '0.04em', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
            >
              {dial.value}
            </text>
            {isActive && (
              <g transform={`translate(${dial.x > 0 ? -(dial.r + 178) : dial.r + 14},${-(dial.r * 0.8)})`}>
                <rect
                  x="0"
                  y="0"
                  rx="10"
                  ry="10"
                  width="164"
                  height={boxHeight}
                  fill="rgba(8,20,45,0.90)"
                  stroke="rgba(252,211,77,0.55)"
                  strokeWidth="1"
                />
                <text
                  x="10"
                  y="18"
                  fill="rgba(254,240,138,0.95)"
                  style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.03em', fontFamily: 'serif' }}
                >
                  {dial.label}
                </text>
                <text
                  x="10"
                  y={descTop}
                  fill="rgba(255,255,255,0.90)"
                  style={{ fontSize: 9.5, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
                >
                  {descLines.map((line, lineIdx) => (
                    <tspan key={`desc-${idx}-${lineIdx}`} x="10" dy={lineIdx === 0 ? 0 : descLineHeight}>
                      {line}
                    </tspan>
                  ))}
                </text>
                <text
                  x="10"
                  y={valueY}
                  fill="rgba(52,211,153,0.95)"
                  style={{ fontSize: 10, fontWeight: 700, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
                >
                  {`Valeur: ${dial.value}`}
                </text>
              </g>
            )}
          </g>
        )
      })}

    </svg>
  )
}

