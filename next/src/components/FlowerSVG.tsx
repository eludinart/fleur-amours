'use client'

import { useId, useState } from 'react'

export type PetalDef = { id: string; name: string; angle: number; color: string; bg: string }

const PETALS: PetalDef[] = [
  { id: 'agape', name: 'Agapè', angle: 0, color: '#f43f5e', bg: '#fff1f2' },
  { id: 'philautia', name: 'Philautia', angle: 45, color: '#f59e0b', bg: '#fffbeb' },
  { id: 'mania', name: 'Mania', angle: 90, color: '#ef4444', bg: '#fef2f2' },
  { id: 'storge', name: 'Storgè', angle: 135, color: '#0d9488', bg: '#f0fdfa' },
  { id: 'pragma', name: 'Pragma', angle: 180, color: '#6366f1', bg: '#eef2ff' },
  { id: 'philia', name: 'Philia', angle: 225, color: '#10b981', bg: '#f0fdf4' },
  { id: 'ludus', name: 'Ludus', angle: 270, color: '#0ea5e9', bg: '#f0f9ff' },
  { id: 'eros', name: 'Éros', angle: 315, color: '#8b5cf6', bg: '#faf5ff' },
]

export const PETAL_DEFS = PETALS

export function scoresToPetals(
  scores: Record<string, number> | null | undefined
): Record<string, number> {
  if (!scores || typeof scores !== 'object') return {}
  const vals = Object.values(scores).filter((v) => typeof v === 'number')
  const dataMax = vals.length ? Math.max(...vals) : 0
  const scale = dataMax > 0 ? dataMax : 1
  const out: Record<string, number> = {}
  for (const p of ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros']) {
    out[p] = Math.min(1, Math.max(0, (scores[p] ?? 0) / scale))
  }
  return out
}

const MIN_LEN = 18
const MAX_LEN = 58
const PETAL_W = 18
const CENTER = 100
const GREEN = { fill: '#34d399', stroke: '#10b981' }
const RED = { fill: '#f87171', stroke: '#dc2626' }
const BLUE = { fill: '#60a5fa', stroke: '#3b82f6' }
const SILHOUETTE = { fill: 'rgba(192,192,208,0.35)', stroke: 'rgba(148,163,184,0.6)' }
const OMBRE_SILHOUETTE = { fill: 'rgba(100,116,139,0.45)', stroke: 'rgba(71,85,105,0.7)' }
const PERSON_A = { fill: '#fda4af', stroke: '#f43f5e' }
const PERSON_B = { fill: '#6ee7b7', stroke: '#10b981' }

function petalPath(halfLen: number, width: number): string {
  const tip = halfLen * 2
  return [
    `M 0 0`,
    `C ${-width * 1.1} ${-halfLen * 0.4}  ${-width * 0.8} ${-tip * 0.7}  0 ${-tip}`,
    `C ${width * 0.8}  ${-tip * 0.7}   ${width * 1.1}  ${-halfLen * 0.4}  0 0`,
    `Z`,
  ].join(' ')
}

type FlowerSVGProps = {
  petals?: Record<string, number>
  petalsDeficit?: Record<string, number>
  petalsEvolution?: { petals?: Record<string, number>; petalsDeficit?: Record<string, number> } | null
  petalsA?: Record<string, number> | null
  petalsB?: Record<string, number> | null
  variant?: 'personA' | 'personB' | 'silhouette' | 'ombre' | null
  size?: number
  animate?: boolean
  showLabels?: boolean
  showScores?: boolean
  labelsOnHoverOnly?: boolean
  highlightedPetalId?: string | null
  labelDistance?: number | null
  onPetalClick?: (petalId: string) => void
  highlightId?: string | null
  overriddenPetals?: Set<string>
  forceDualStyle?: boolean
}

export function FlowerSVG({
  petals = {},
  petalsDeficit = {},
  petalsEvolution = null,
  petalsA = null,
  petalsB = null,
  variant = null,
  size = 300,
  animate = true,
  showLabels = true,
  showScores = true,
  labelsOnHoverOnly = false,
  highlightedPetalId = null,
  labelDistance = null,
  onPetalClick,
  highlightId,
  overriddenPetals = new Set(),
  forceDualStyle = false,
}: FlowerSVGProps) {
  const uid = useId().replace(/:/g, '')
  const [hoveredPetalId, setHoveredPetalId] = useState<string | null>(null)
  const c = CENTER
  const isOverlayMode = petalsA != null && petalsB != null
  const hasDeficit = Object.values(petalsDeficit || {}).some((v) => (v ?? 0) > 0.05)
  const hasEvolution =
    petalsEvolution &&
    PETALS.some((p) => {
      const evoP = (petalsEvolution.petals || {})[p.id] ?? 0
      const evoD = (petalsEvolution.petalsDeficit || {})[p.id] ?? 0
      return evoP > 0.05 || evoD > 0.05
    })
  const dualMode = forceDualStyle || !!hasDeficit || !!hasEvolution || petalsEvolution != null

  const padding = 68
  const vbSize = 200 + padding * 2
  return (
    <svg
      viewBox={`${-padding} ${-padding} ${vbSize} ${vbSize}`}
      width={size}
      height={size}
      className="flower-svg max-w-full h-auto mx-auto block"
      preserveAspectRatio="xMidYMid meet"
      aria-label="Fleur d'AmOurs — 8 pétales"
    >
      <defs>
        {PETALS.map((p) => (
          <radialGradient key={p.id} id={`${uid}-grad-${p.id}`} cx="50%" cy="80%" r="70%">
            <stop offset="0%" stopColor={p.color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={p.color} stopOpacity="0.85" />
          </radialGradient>
        ))}
        <radialGradient id={`${uid}-grad-present`} cx="50%" cy="80%" r="70%">
          <stop offset="0%" stopColor={GREEN.fill} stopOpacity="0.2" />
          <stop offset="100%" stopColor={GREEN.fill} stopOpacity="0.85" />
        </radialGradient>
        <radialGradient id={`${uid}-grad-deficit`} cx="50%" cy="80%" r="70%">
          <stop offset="0%" stopColor="#fca5a5" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#dc2626" stopOpacity="0.95" />
        </radialGradient>
        <radialGradient id={`${uid}-grad-evolution`} cx="50%" cy="80%" r="70%">
          <stop offset="0%" stopColor={BLUE.fill} stopOpacity="0.15" />
          <stop offset="100%" stopColor={BLUE.fill} stopOpacity="0.5" />
        </radialGradient>
        <filter id={`${uid}-petal-glow`}>
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id={`${uid}-flower-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#000" floodOpacity="0.12" />
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.08" />
        </filter>
        <filter id={`${uid}-label-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0.4" stdDeviation="0.8" floodColor="#000" floodOpacity="0.25" />
        </filter>
        <radialGradient id={`${uid}-center-grad`} cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#fecdd3" stopOpacity="0.9" />
          <stop offset="70%" stopColor="#fda4af" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.4" />
        </radialGradient>
        <radialGradient id={`${uid}-grad-personA`} cx="50%" cy="80%" r="70%">
          <stop offset="0%" stopColor={PERSON_A.fill} stopOpacity="0.25" />
          <stop offset="100%" stopColor={PERSON_A.stroke} stopOpacity="0.75" />
        </radialGradient>
        <radialGradient id={`${uid}-grad-personB`} cx="50%" cy="80%" r="70%">
          <stop offset="0%" stopColor={PERSON_B.fill} stopOpacity="0.25" />
          <stop offset="100%" stopColor={PERSON_B.stroke} stopOpacity="0.75" />
        </radialGradient>
      </defs>

      <g filter={`url(#${uid}-flower-shadow)`}>
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <circle
            key={t}
            cx={c}
            cy={c}
            r={(MIN_LEN + t * (MAX_LEN - MIN_LEN)) * 1.15}
            fill="none"
            stroke="rgba(148,163,184,0.22)"
            strokeWidth="0.4"
            strokeDasharray={t === 1 ? undefined : '2,3'}
          />
        ))}

        {PETALS.map((p) => {
          const rad = ((p.angle - 90) * Math.PI) / 180
          const reach = MAX_LEN * 2.1
          return (
            <line
              key={p.id}
              x1={c}
              y1={c}
              x2={c + Math.cos(rad) * reach}
              y2={c + Math.sin(rad) * reach}
              stroke="rgba(148,163,184,0.2)"
              strokeWidth="0.4"
            />
          )
        })}

        {isOverlayMode &&
          PETALS.map((p) => {
            const valA = Math.max(0, Math.min(1, petalsA![p.id] ?? 0))
            const valB = Math.max(0, Math.min(1, petalsB![p.id] ?? 0))
            const halfLenA = MIN_LEN + valA * (MAX_LEN - MIN_LEN)
            const halfLenB = MIN_LEN + valB * (MAX_LEN - MIN_LEN)
            const rad = p.angle
            return (
              <g key={`overlay-${p.id}`}>
                <g transform={`translate(${c}, ${c}) rotate(${rad})`}>
                  <path
                    d={petalPath(halfLenA, PETAL_W * 0.95)}
                    fill={`url(#${uid}-grad-personA)`}
                    stroke={PERSON_A.stroke}
                    strokeWidth={1.2}
                    strokeOpacity={0.9}
                    opacity={0.5 + valA * 0.4}
                    style={animate ? { transition: 'd 0.5s ease, opacity 0.5s ease' } : {}}
                  />
                </g>
                <g transform={`translate(${c}, ${c}) rotate(${rad})`}>
                  <path
                    d={petalPath(halfLenB, PETAL_W * 0.85)}
                    fill={`url(#${uid}-grad-personB)`}
                    stroke={PERSON_B.stroke}
                    strokeWidth={1.4}
                    strokeOpacity={0.95}
                    strokeDasharray="5,3"
                    opacity={0.55 + valB * 0.4}
                    style={animate ? { transition: 'd 0.5s ease, opacity 0.5s ease' } : {}}
                  />
                </g>
              </g>
            )
          })}

        {hasEvolution &&
          petalsEvolution &&
          PETALS.map((p) => {
            const evoPetals = petalsEvolution.petals || {}
            const evoDeficit = petalsEvolution.petalsDeficit || {}
            const evoPos = Math.max(0, Math.min(1, evoPetals[p.id] ?? 0))
            const evoNeg = Math.max(0, Math.min(1, evoDeficit[p.id] ?? 0))
            const evoLen = Math.max(evoPos, evoNeg)
            if (evoLen < 0.05) return null
            const halfLen = MIN_LEN + evoLen * (MAX_LEN - MIN_LEN)
            const rad = p.angle
            return (
              <g key={`evolution-${p.id}`} transform={`translate(${c}, ${c}) rotate(${rad})`}>
                <path
                  d={petalPath(halfLen, PETAL_W * 0.85)}
                  fill="none"
                  stroke={BLUE.stroke}
                  strokeWidth={1.2}
                  strokeDasharray="4,3"
                  opacity={0.5}
                  style={animate ? { transition: 'd 0.6s ease, opacity 0.6s ease' } : {}}
                />
              </g>
            )
          })}

        {!isOverlayMode && hasDeficit && (
          <g
            transform={`translate(${c}, ${c}) rotate(-18) scale(0.80) translate(${-c}, ${-c})`}
            opacity={0.95}
          >
            {PETALS.map((p) => {
              const def = Math.max(0, Math.min(1, petalsDeficit[p.id] ?? 0))
              const halfLen = MIN_LEN + (def > 0.03 ? def : 0) * (MAX_LEN - MIN_LEN)
              const rad = p.angle
              return (
                <g key={`ombre-${p.id}`} transform={`translate(${c}, ${c}) rotate(${rad})`}>
                  <path
                    d={petalPath(halfLen, PETAL_W * 1.0)}
                    fill={def > 0.03 ? `url(#${uid}-grad-deficit)` : 'none'}
                    stroke={RED.stroke}
                    strokeWidth={def > 0.03 ? 2.2 : 1.4}
                    strokeOpacity={def > 0.03 ? 1 : 0.5}
                    strokeDasharray="6,3"
                    opacity={def > 0.03 ? 0.85 : 0.25}
                    style={animate ? { transition: 'd 0.6s ease, opacity 0.6s ease' } : {}}
                  />
                </g>
              )
            })}
          </g>
        )}

        {!isOverlayMode &&
          PETALS.map((p, idx) => {
            const intensity = Math.max(0, Math.min(1, petals[p.id] ?? 0))
            const halfLen = MIN_LEN + intensity * (MAX_LEN - MIN_LEN)
            const isHighlit = highlightId === p.id
            const isOverridden = overriddenPetals.has(p.id)
            const rad = p.angle
            const canHover = onPetalClick != null || labelsOnHoverOnly
            return (
              <g
                key={p.id}
                className={`flower-petal ${canHover ? 'flower-petal--clickable' : ''}`}
                transform={`translate(${c}, ${c}) rotate(${rad})`}
                onMouseEnter={labelsOnHoverOnly ? () => setHoveredPetalId(p.id) : undefined}
                onMouseLeave={labelsOnHoverOnly ? () => setHoveredPetalId(null) : undefined}
                onClick={() => onPetalClick?.(p.id)}
                style={{
                  cursor: onPetalClick || labelsOnHoverOnly ? 'pointer' : 'default',
                  animation: animate ? 'flowerPetalEnter 0.5s ease forwards' : undefined,
                  animationDelay: animate ? `${idx * 45}ms` : undefined,
                  ...(animate ? { transition: 'all 0.6s cubic-bezier(.23,1.12,.32,1)' } : {}),
                }}
              >
                <path
                  d={petalPath(halfLen, PETAL_W)}
                  fill={
                    variant === 'personA'
                      ? PERSON_A.stroke
                      : variant === 'personB'
                        ? PERSON_B.stroke
                        : variant === 'ombre'
                          ? OMBRE_SILHOUETTE.stroke
                          : variant === 'silhouette'
                            ? SILHOUETTE.stroke
                            : dualMode
                              ? GREEN.stroke
                              : p.color
                  }
                  opacity={0.08 + intensity * 0.07}
                  transform="scale(1.12)"
                  style={animate ? { transition: 'd 0.6s ease, opacity 0.6s ease' } : {}}
                />
                <path
                  className="petal-main"
                  d={petalPath(halfLen, PETAL_W)}
                  fill={
                    variant === 'silhouette' || variant === 'ombre'
                      ? variant === 'ombre'
                        ? OMBRE_SILHOUETTE.fill
                        : SILHOUETTE.fill
                      : variant === 'personA'
                        ? `url(#${uid}-grad-personA)`
                        : variant === 'personB'
                          ? `url(#${uid}-grad-personB)`
                          : dualMode
                            ? `url(#${uid}-grad-present)`
                            : `url(#${uid}-grad-${p.id})`
                  }
                  stroke={
                    variant === 'silhouette' || variant === 'ombre'
                      ? variant === 'ombre'
                        ? OMBRE_SILHOUETTE.stroke
                        : SILHOUETTE.stroke
                      : variant === 'personA'
                        ? PERSON_A.stroke
                        : variant === 'personB'
                          ? PERSON_B.stroke
                          : dualMode
                            ? GREEN.stroke
                            : p.color
                  }
                  strokeWidth={
                    variant === 'silhouette' || variant === 'ombre' ? 1.2 : isHighlit ? 1.8 : isOverridden ? 1.2 : 0.8
                  }
                  strokeOpacity={variant === 'silhouette' || variant === 'ombre' ? 0.7 : isOverridden ? 0.9 : 0.6}
                  strokeDasharray={isOverridden ? '3,1.5' : undefined}
                  opacity={
                    variant === 'silhouette' || variant === 'ombre'
                      ? variant === 'ombre'
                        ? 0.55 + intensity * 0.25
                        : 0.5 + intensity * 0.3
                      : 0.35 + intensity * 0.65
                  }
                  filter={isHighlit ? `url(#${uid}-petal-glow)` : undefined}
                  style={animate ? { transition: 'd 0.6s cubic-bezier(.23,1.12,.32,1), opacity 0.6s ease' } : {}}
                />
                {intensity > 0.05 && (
                  <circle
                    cx={0}
                    cy={-(halfLen * 2 + 3)}
                    r={isOverridden ? 3 : 2}
                    fill={
                      isOverridden
                        ? 'white'
                        : variant === 'personA'
                          ? PERSON_A.stroke
                          : variant === 'personB'
                            ? PERSON_B.stroke
                            : variant === 'ombre'
                              ? OMBRE_SILHOUETTE.stroke
                              : variant === 'silhouette'
                                ? SILHOUETTE.stroke
                                : dualMode
                                  ? GREEN.stroke
                                  : p.color
                    }
                    stroke={
                      variant === 'personA'
                        ? PERSON_A.stroke
                        : variant === 'personB'
                          ? PERSON_B.stroke
                          : variant === 'ombre'
                            ? OMBRE_SILHOUETTE.stroke
                            : variant === 'silhouette'
                              ? SILHOUETTE.stroke
                              : dualMode
                                ? GREEN.stroke
                                : p.color
                    }
                    strokeWidth={isOverridden ? 1.2 : 0}
                    opacity={0.9}
                  />
                )}
                {isOverridden && intensity > 0.05 && (
                  <text
                    x={0}
                    y={-(halfLen * 2 + 10)}
                    textAnchor="middle"
                    fontSize={5}
                    fill={dualMode ? GREEN.stroke : p.color}
                    fontFamily="system-ui"
                  >
                    ✎
                  </text>
                )}
              </g>
            )
          })}

        <circle
          cx={c}
          cy={c}
          r={8}
          fill={`url(#${uid}-center-grad)`}
          stroke="rgba(253,164,175,0.6)"
          strokeWidth="0.8"
        />
        <circle cx={c} cy={c} r={3} fill="#f43f5e" opacity="0.85" />

        {(showLabels || (labelsOnHoverOnly && (highlightedPetalId ?? hoveredPetalId))) &&
          PETALS.map((p) => {
            if (labelsOnHoverOnly && p.id !== (highlightedPetalId ?? hoveredPetalId)) return null
            const intensity = isOverlayMode ? 0 : (petals[p.id] ?? 0)
            const def = petalsDeficit[p.id] ?? 0
            const rad = ((p.angle - 90) * Math.PI) / 180
            const dist = labelDistance ?? MAX_LEN * 2 + 16
            const x = c + Math.cos(rad) * dist
            const y = c + Math.sin(rad) * dist + dist * 0.15
            const pctA = isOverlayMode ? Math.round((petalsA?.[p.id] ?? 0) * 100) : 0
            const pctB = isOverlayMode ? Math.round((petalsB?.[p.id] ?? 0) * 100) : 0
            const pct = Math.round(intensity * 100)
            const defPct = Math.round(def * 100)
            const showDualPct = !isOverlayMode && dualMode && (intensity > 0.05 || def > 0.05)
            const fillColor =
              variant === 'personA'
                ? PERSON_A.stroke
                : variant === 'personB'
                  ? PERSON_B.stroke
                  : variant === 'ombre'
                    ? OMBRE_SILHOUETTE.stroke
                    : variant === 'silhouette'
                      ? SILHOUETTE.stroke
                      : dualMode
                        ? intensity > 0.3
                          ? GREEN.stroke
                          : def > 0.3
                            ? RED.stroke
                            : '#64748b'
                        : intensity > 0.3
                          ? p.color
                          : '#64748b'
            const labelFill = isOverlayMode ? '#475569' : fillColor
            const isMutedLabel = labelFill === '#64748b' || labelFill === '#475569'
            return (
              <g
                key={p.id}
                filter={`url(#${uid}-label-shadow)`}
                className={`flower-petal-label ${isMutedLabel ? 'flower-label-muted' : ''}`}
              >
                <text
                  x={x}
                  y={y - 8}
                  textAnchor="middle"
                  fontSize={16}
                  fontFamily="system-ui, sans-serif"
                  fontWeight="600"
                  fill={isOverlayMode ? '#475569' : fillColor}
                  className="flower-label-name"
                  style={animate ? { transition: 'fill 0.4s ease' } : {}}
                >
                  {p.name}
                  {overriddenPetals.has(p.id) ? ' ✎' : ''}
                </text>
                {showScores && (
                  <text
                    x={x}
                    y={y + 9}
                    textAnchor="middle"
                    fontSize={9}
                    fontFamily="system-ui, sans-serif"
                    className="flower-label-score"
                    fill="#64748b"
                  >
                    {isOverlayMode ? `A:${pctA} B:${pctB}` : showDualPct ? `${pct}% · ${defPct}%` : `${pct}%`}
                  </text>
                )}
              </g>
            )
          })}
      </g>
    </svg>
  )
}

type PetalSliderProps = {
  petalId: string
  label: string
  color: string
  value: number
  onChange: (petalId: string, value: number) => void
}

export function PetalSlider({ petalId, label, color, value, onChange }: PetalSliderProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold w-20 text-right" style={{ color }}>
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(petalId, Number(e.target.value) / 100)}
        className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: color }}
      />
      <span className="text-xs text-slate-400 w-8">{Math.round(value * 100)}%</span>
    </div>
  )
}
