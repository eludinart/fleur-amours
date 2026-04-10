/**
 * Rosace fleur pour les images OG (next/og) — même géométrie que l’OG Fleur.
 */
import { PETAL_DEFS } from '@/lib/petal-theme'

function petalPath(halfLen: number, width: number): string {
  const tip = halfLen * 2
  return [
    `M 0 0`,
    `C ${-width * 1.1} ${-halfLen * 0.4}  ${-width * 0.8} ${-tip * 0.7}  0 ${-tip}`,
    `C ${width * 0.8}  ${-tip * 0.7}   ${width * 1.1}  ${-halfLen * 0.4}  0 0`,
    `Z`,
  ].join(' ')
}

type OgFlowerGraphicProps = {
  scores: Record<string, number>
  dominant?: string | null
  /** Taille du viewBox (défaut 260 comme OG fleur résultat). */
  size?: number
  center?: number
  minLen?: number
  maxLen?: number
  petalWidth?: number
}

export function OgFlowerGraphic({
  scores,
  dominant = null,
  size = 260,
  center = 120,
  minLen = 22,
  maxLen = 88,
  petalWidth = 24,
}: OgFlowerGraphicProps) {
  const vals = Object.values(scores).filter((v) => typeof v === 'number')
  const dataMax = vals.length ? Math.max(...vals) : 1
  const scale = dataMax > 0 ? dataMax : 1

  return (
    <svg width={size} height={size} viewBox={`-${center} -${center} ${size * 2} ${size * 2}`}>
      {PETAL_DEFS.map((p) => {
        const normalized = Math.min(1, Math.max(0, (scores[p.id] ?? 0) / scale))
        const halfLen = minLen + normalized * (maxLen - minLen)
        const path = petalPath(halfLen, petalWidth)
        const isHigh = p.id === dominant
        return (
          <g key={p.id} transform={`rotate(${p.angle}, 0, 0)`}>
            <path
              d={path}
              fill={p.color}
              opacity={isHigh ? 0.97 : 0.68}
              stroke={p.color}
              strokeWidth={isHigh ? 2 : 0.6}
              strokeOpacity={0.35}
            />
          </g>
        )
      })}
      <circle cx={0} cy={0} r={16} fill="white" opacity={0.95} />
      <circle cx={0} cy={0} r={9} fill="#faf6f0" />
    </svg>
  )
}
