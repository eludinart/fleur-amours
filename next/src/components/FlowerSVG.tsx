'use client'

import { useId, useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
  PETAL_DEFS,
  PETAL_BY_ID,
  PETAL_ORDER_IDS,
  FLOWER_CORE_GRADIENT_STOPS,
  FLOWER_PERSON_GRADIENT,
  FLOWER_CENTER_INNER_DOT_FALLBACK,
  type PetalDef,
} from '@/lib/petal-theme'

export type { PetalDef }
export { PETAL_DEFS }

export function scoresToPetals(
  scores: Record<string, number> | null | undefined
): Record<string, number> {
  if (!scores || typeof scores !== 'object') return {}
  const vals = Object.values(scores).filter((v) => typeof v === 'number')
  const dataMax = vals.length ? Math.max(...vals) : 0
  // If the data already looks normalized (0..1), do NOT renormalize again.
  // Otherwise, petals can appear "inflated" (e.g. when comparing sessions).
  const scale = dataMax > 1.05 ? dataMax : 1
  const out: Record<string, number> = {}
  for (const p of PETAL_ORDER_IDS) {
    out[p] = Math.min(1, Math.max(0, (scores[p] ?? 0) / scale))
  }
  return out
}

const MIN_LEN = 18
const MAX_LEN = 58
const PETAL_W = 18
const CENTER = 100
const GREEN = { fill: '#34d399', stroke: PETAL_BY_ID.philia.color }
const RED = { fill: '#f87171', stroke: '#dc2626' }
const BLUE = { fill: '#60a5fa', stroke: '#3b82f6' }
const SILHOUETTE = { fill: 'rgba(192,192,208,0.35)', stroke: 'rgba(148,163,184,0.6)' }
const OMBRE_SILHOUETTE = { fill: 'rgba(100,116,139,0.45)', stroke: 'rgba(71,85,105,0.7)' }
const PERSON_A = {
  fill: FLOWER_PERSON_GRADIENT.a.fill,
  stroke: PETAL_BY_ID[FLOWER_PERSON_GRADIENT.a.strokeFromPetalId].color,
}
const PERSON_B = {
  fill: FLOWER_PERSON_GRADIENT.b.fill,
  stroke: PETAL_BY_ID[FLOWER_PERSON_GRADIENT.b.strokeFromPetalId].color,
}

/** Score élevé → plus lumineux et saturé ; déficit → plus terne (désature + assombrit légèrement). */
function petalVibranceFilter(deploy: number, deficit: number, historicalView: boolean): string | undefined {
  const d = Math.max(0, Math.min(1, deploy))
  const t = Math.max(0, Math.min(1, deficit))
  const damp = historicalView ? 0.62 : 1
  const bright = 1 + d * 0.14 * damp - t * 0.22 * damp
  const sat = 1 + d * 0.22 * damp - t * 0.45 * damp
  if (Math.abs(bright - 1) < 0.025 && Math.abs(sat - 1) < 0.025) return undefined
  const b = Math.max(0.76, Math.min(1.18, bright))
  const s = Math.max(0.5, Math.min(1.32, sat))
  return `saturate(${s.toFixed(3)}) brightness(${b.toFixed(3)})`
}

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
  /** Respiration légère (scale ~1.02) sur ce pétale — ex. pétale dominant du jour */
  pulsePetalId?: string | null
  disablePulse?: boolean
  /** Si défini avec onPetalClick, seuls ces pétales sont cliquables (ex. pétales « faibles »). */
  clickablePetals?: Set<string> | null
  /** Classes CSS additionnelles sur l’élément `<svg>` (ex. halo en vue sombre). */
  svgClassName?: string
  /** Avec `labelsOnHoverOnly` : ids dont le libellé reste visible au repos (ex. top 3). */
  pinnedLabelIds?: string[] | null
  /** Contraste des libellés sur fond sombre (contour / couleurs adoucies). */
  labelTheme?: 'default' | 'dark'
  /** Durée d’affichage du nom après pointer/tap (0 = désactivé). Utile au tactile. */
  labelPeekMs?: number
  /** Préréglage visuel (ex. vue Fleur zen : cœur teinté, bloom dominant, contraste sombre). */
  visualPreset?: 'default' | 'zen'
  /** Instantané temporel choisi (pas la synthèse) — léger refroidissement visuel. */
  historicalView?: boolean
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
  pulsePetalId = null,
  disablePulse = false,
  clickablePetals = null,
  svgClassName = '',
  pinnedLabelIds = null,
  labelTheme = 'default',
  labelPeekMs = 0,
  visualPreset = 'default',
  historicalView = false,
}: FlowerSVGProps) {
  const uid = useId().replace(/:/g, '')
  const [hoveredPetalId, setHoveredPetalId] = useState<string | null>(null)
  const [peekPetalId, setPeekPetalId] = useState<string | null>(null)
  const [pressedPetalId, setPressedPetalId] = useState<string | null>(null)
  const peekClearRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const c = CENTER
  const isZenVisual = visualPreset === 'zen'

  const pinnedSet = useMemo(() => {
    const fromProp = pinnedLabelIds?.filter(Boolean) ?? []
    if (fromProp.length > 0) return new Set(fromProp)
    if (highlightedPetalId) return new Set([highlightedPetalId])
    return new Set<string>()
  }, [pinnedLabelIds, highlightedPetalId])

  const clearPeekTimer = useCallback(() => {
    if (peekClearRef.current != null) {
      clearTimeout(peekClearRef.current)
      peekClearRef.current = null
    }
  }, [])

  const bumpPeek = useCallback(
    (id: string) => {
      if (!labelPeekMs || labelPeekMs <= 0 || !labelsOnHoverOnly) return
      clearPeekTimer()
      setPeekPetalId(id)
      peekClearRef.current = setTimeout(() => {
        setPeekPetalId(null)
        peekClearRef.current = null
      }, labelPeekMs)
    },
    [labelPeekMs, labelsOnHoverOnly, clearPeekTimer]
  )

  useEffect(() => () => clearPeekTimer(), [clearPeekTimer])

  useEffect(() => {
    if (!pressedPetalId) return
    const clear = () => setPressedPetalId(null)
    window.addEventListener('pointerup', clear)
    window.addEventListener('pointercancel', clear)
    return () => {
      window.removeEventListener('pointerup', clear)
      window.removeEventListener('pointercancel', clear)
    }
  }, [pressedPetalId])

  /** Une seule fois au montage : évite de relancer `flowerPetalEnter` à chaque changement de pétales (glitch zen / time-scroll). */
  const [petalEnterDone, setPetalEnterDone] = useState(!animate)
  useEffect(() => {
    if (!animate) {
      setPetalEnterDone(true)
      return
    }
    setPetalEnterDone(false)
    const maxStagger = (PETAL_DEFS.length - 1) * 45
    const tid = window.setTimeout(() => setPetalEnterDone(true), 520 + maxStagger)
    return () => window.clearTimeout(tid)
  }, [animate])

  const accentPetalDef = useMemo(
    () => (pulsePetalId ? PETAL_DEFS.find((x) => x.id === pulsePetalId) ?? null : null),
    [pulsePetalId]
  )

  const isOverlayMode = petalsA != null && petalsB != null
  const hasDeficit = Object.values(petalsDeficit || {}).some((v) => (v ?? 0) > 0.05)
  const hasEvolution =
    petalsEvolution &&
    PETAL_DEFS.some((p) => {
      const evoP = (petalsEvolution.petals || {})[p.id] ?? 0
      const evoD = (petalsEvolution.petalsDeficit || {})[p.id] ?? 0
      return evoP > 0.05 || evoD > 0.05
    })
  const dualMode = forceDualStyle || !!hasDeficit || !!hasEvolution || petalsEvolution != null

  const padding = 68
  const vbSize = 200 + padding * 2

  const svgFilterStyle = useMemo(() => {
    if (!isZenVisual) return undefined
    const base = 'drop-shadow(0 0 28px rgba(45,212,191,0.14))'
    if (historicalView) return `${base} saturate(0.9) brightness(1.07) hue-rotate(-8deg)`
    return base
  }, [isZenVisual, historicalView])

  return (
    <svg
      viewBox={`${-padding} ${-padding} ${vbSize} ${vbSize}`}
      width={size}
      height={size}
      className={`flower-svg max-w-full h-auto mx-auto block ${svgClassName}`.trim()}
      style={{
        filter: svgFilterStyle,
      }}
      preserveAspectRatio="xMidYMid meet"
      aria-label="Fleur d'AmOurs — 8 pétales"
    >
      <defs>
        {PETAL_DEFS.map((p) => (
          <radialGradient key={p.id} id={`${uid}-grad-${p.id}`} cx="50%" cy="80%" r="70%">
            <stop offset="0%" stopColor={p.color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={p.color} stopOpacity="0.94" />
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
        <filter id={`${uid}-petal-glow-dominant`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${uid}-petal-bloom`} x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${uid}-flower-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#000" floodOpacity="0.12" />
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.08" />
        </filter>
        <filter id={`${uid}-label-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0.4" stdDeviation="0.8" floodColor="#000" floodOpacity="0.25" />
        </filter>
        <radialGradient id={`${uid}-center-grad`} cx="35%" cy="35%" r="70%">
          <stop
            offset="0%"
            stopColor={FLOWER_CORE_GRADIENT_STOPS.inner.color}
            stopOpacity={FLOWER_CORE_GRADIENT_STOPS.inner.opacity}
          />
          <stop
            offset="70%"
            stopColor={FLOWER_CORE_GRADIENT_STOPS.mid.color}
            stopOpacity={FLOWER_CORE_GRADIENT_STOPS.mid.opacity}
          />
          <stop
            offset="100%"
            stopColor={FLOWER_CORE_GRADIENT_STOPS.outer.color}
            stopOpacity={FLOWER_CORE_GRADIENT_STOPS.outer.opacity}
          />
        </radialGradient>
        {isZenVisual && accentPetalDef ? (
          <radialGradient id={`${uid}-center-grad-accent`} cx="38%" cy="36%" r="72%">
            <stop offset="0%" stopColor="#fffafb" stopOpacity="0.98" />
            <stop offset="40%" stopColor={accentPetalDef.color} stopOpacity="0.45" />
            <stop offset="100%" stopColor={accentPetalDef.color} stopOpacity="0.62" />
          </radialGradient>
        ) : null}
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

        {PETAL_DEFS.map((p) => {
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
          PETAL_DEFS.map((p) => {
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
          PETAL_DEFS.map((p) => {
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
            {PETAL_DEFS.map((p) => {
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
                    opacity={def > 0.03 ? 0.68 : 0.2}
                    style={animate ? { transition: 'd 0.6s ease, opacity 0.6s ease' } : {}}
                  />
                </g>
              )
            })}
          </g>
        )}

        {!isOverlayMode &&
          PETAL_DEFS.map((p, idx) => {
            const intensity = Math.max(0, Math.min(1, petals[p.id] ?? 0))
            const deficitAmt = Math.max(0, Math.min(1, petalsDeficit[p.id] ?? 0))
            const halfLen = MIN_LEN + intensity * (MAX_LEN - MIN_LEN)
            const isHighlit = highlightId === p.id
            const isOverridden = overriddenPetals.has(p.id)
            const rad = p.angle
            const petalCta =
              onPetalClick != null && (clickablePetals == null || clickablePetals.has(p.id))
            const canHover = petalCta || labelsOnHoverOnly
            const doPulse = pulsePetalId === p.id && !disablePulse
            const zenNatural = isZenVisual && !dualMode && !variant
            const isDominantZen = zenNatural && pulsePetalId === p.id && intensity > 0.06
            const pressScale = isZenVisual && pressedPetalId === p.id ? 1.058 : 1
            return (
              <g
                key={p.id}
                className={`flower-petal ${canHover ? 'flower-petal--clickable' : ''}`}
                transform={`translate(${c}, ${c}) rotate(${rad}) scale(${pressScale})`}
                onMouseEnter={labelsOnHoverOnly ? () => setHoveredPetalId(p.id) : undefined}
                onMouseLeave={labelsOnHoverOnly ? () => setHoveredPetalId(null) : undefined}
                onPointerDown={() => {
                  if (labelsOnHoverOnly && labelPeekMs > 0) bumpPeek(p.id)
                  if (isZenVisual) setPressedPetalId(p.id)
                }}
                onClick={() => petalCta && onPetalClick?.(p.id)}
                style={{
                  cursor: petalCta || labelsOnHoverOnly ? 'pointer' : 'default',
                  filter:
                    variant == null && !isOverlayMode
                      ? petalVibranceFilter(intensity, deficitAmt, historicalView)
                      : undefined,
                  animation:
                    animate && !petalEnterDone
                      ? `flowerPetalEnter 0.5s ease forwards`
                      : undefined,
                  animationDelay:
                    animate && !petalEnterDone ? `${idx * 45}ms` : undefined,
                  ...(animate
                    ? {
                        transition: isZenVisual
                          ? 'transform 0.16s cubic-bezier(.23,1,.32,1), filter 0.45s ease'
                          : 'all 0.6s cubic-bezier(.23,1.12,.32,1), filter 0.45s ease',
                      }
                    : {}),
                }}
              >
                <g>
                  {doPulse ? (
                    <animateTransform
                      attributeName="transform"
                      attributeType="XML"
                      type="scale"
                      values="1;1.02;1"
                      keyTimes="0;0.5;1"
                      dur="3.2s"
                      repeatCount="indefinite"
                    />
                  ) : null}
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
                  opacity={zenNatural ? 0.08 + intensity * 0.09 : 0.1 + intensity * 0.08}
                  transform="scale(1.12)"
                  style={animate ? { transition: 'd 0.6s ease, opacity 0.6s ease' } : {}}
                />
                {isDominantZen ? (
                  <path
                    d={petalPath(halfLen, PETAL_W)}
                    fill={`url(#${uid}-grad-${p.id})`}
                    opacity={deficitAmt > 0.12 ? 0.28 : 0.44}
                    filter={`url(#${uid}-petal-bloom)`}
                    style={animate ? { transition: 'd 0.6s ease, opacity 0.6s ease' } : {}}
                  />
                ) : null}
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
                    variant === 'silhouette' || variant === 'ombre'
                      ? 1.2
                      : zenNatural
                        ? isHighlit
                          ? 1.95
                          : isOverridden
                            ? 1.35
                            : isDominantZen
                              ? 1.25
                              : 1.02
                        : isHighlit
                          ? 1.8
                          : isOverridden
                            ? 1.2
                            : 0.8
                  }
                  strokeOpacity={
                    variant === 'silhouette' || variant === 'ombre'
                      ? 0.7
                      : isOverridden
                        ? 0.9
                        : zenNatural
                          ? isDominantZen
                            ? 0.78
                            : 0.68
                          : 0.6
                  }
                  strokeDasharray={isOverridden ? '3,1.5' : undefined}
                  opacity={
                    variant === 'silhouette' || variant === 'ombre'
                      ? variant === 'ombre'
                        ? 0.55 + intensity * 0.25
                        : 0.5 + intensity * 0.3
                      : zenNatural
                        ? 0.34 + intensity * 0.74
                        : 0.4 + intensity * 0.64
                  }
                  filter={
                    isDominantZen
                      ? `url(#${uid}-petal-glow-dominant)`
                      : isHighlit
                        ? `url(#${uid}-petal-glow)`
                        : undefined
                  }
                  style={animate ? { transition: 'd 0.6s cubic-bezier(.23,1.12,.32,1), opacity 0.6s ease' } : {}}
                />
                {isDominantZen ? (
                  <path
                    d={petalPath(halfLen, PETAL_W)}
                    fill="none"
                    stroke="rgba(255,255,255,0.38)"
                    strokeWidth={1.1}
                    strokeLinecap="round"
                    pointerEvents="none"
                  />
                ) : null}
                {intensity > 0.05 && (
                  <circle
                    cx={0}
                    cy={-(halfLen * 2 + 3)}
                    r={isDominantZen ? 3.3 : isOverridden ? 3 : 2}
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
              </g>
            )
          })}

        <circle
          cx={c}
          cy={c}
          r={isZenVisual && accentPetalDef ? 8.6 : 8}
          fill={
            isZenVisual && accentPetalDef ? `url(#${uid}-center-grad-accent)` : `url(#${uid}-center-grad)`
          }
          stroke={isZenVisual && accentPetalDef ? accentPetalDef.color : 'rgba(253,164,175,0.6)'}
          strokeOpacity={isZenVisual && accentPetalDef ? 0.55 : 1}
          strokeWidth={isZenVisual && accentPetalDef ? 1 : 0.8}
          style={isZenVisual ? { transition: 'r 0.5s ease, stroke 0.5s ease' } : undefined}
        />
        <circle
          cx={c}
          cy={c}
          r={isZenVisual && accentPetalDef ? 3.2 : 3}
          fill={accentPetalDef?.color ?? FLOWER_CENTER_INNER_DOT_FALLBACK}
          opacity={isZenVisual && accentPetalDef ? 0.92 : 0.85}
        />

        {(showLabels ||
          (labelsOnHoverOnly &&
            (pinnedSet.size > 0 || !!hoveredPetalId || !!peekPetalId || !!highlightedPetalId))) &&
          PETAL_DEFS.map((p) => {
            const labelFocus = p.id === hoveredPetalId || p.id === peekPetalId
            if (
              labelsOnHoverOnly &&
              !pinnedSet.has(p.id) &&
              !labelFocus
            )
              return null
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
            const dark = labelTheme === 'dark' && !isOverlayMode
            const anchorOnly = labelsOnHoverOnly && pinnedSet.has(p.id) && !labelFocus
            const nameFontSize = dark ? (labelFocus ? 16 : anchorOnly ? 13 : 15) : labelFocus ? 17 : anchorOnly ? 14 : 16
            const nameOpacity = dark && anchorOnly ? 0.9 : 1
            const darkMutedFill = '#cbd5e1'
            const darkMutedStroke = '#020617'
            const darkColorStroke = 'rgba(15,23,42,0.72)'
            const resolvedFill = dark && isMutedLabel ? darkMutedFill : isOverlayMode ? '#475569' : fillColor
            const nameStroke = dark
              ? isMutedLabel
                ? darkMutedStroke
                : darkColorStroke
              : undefined
            const nameStrokeWidth = dark ? (isMutedLabel ? 2.6 : 1.35) : undefined
            return (
              <g
                key={p.id}
                filter={dark ? undefined : `url(#${uid}-label-shadow)`}
                className={`flower-petal-label ${isMutedLabel ? 'flower-label-muted' : ''}`}
                opacity={nameOpacity}
              >
                <text
                  x={x}
                  y={y - 8}
                  textAnchor="middle"
                  fontSize={nameFontSize}
                  fontFamily="system-ui, sans-serif"
                  fontWeight={labelFocus ? 700 : 600}
                  fill={resolvedFill}
                  stroke={nameStroke}
                  strokeWidth={nameStrokeWidth}
                  paintOrder={dark ? 'stroke fill' : undefined}
                  className="flower-label-name"
                  style={animate ? { transition: 'fill 0.4s ease, font-size 0.2s ease' } : {}}
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
                    fill={dark ? '#94a3b8' : '#64748b'}
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
