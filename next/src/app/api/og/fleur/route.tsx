/**
 * GET /api/og/fleur?id=…
 * Carte Open Graph 1200×630 — Fleur d'AmOurs, promesse + preuve visuelle + CTA.
 */
import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { getResult } from '@/lib/db-fleur'
import {
  OG_FLEUR_CHIPS,
  OG_FLEUR_CTA,
  OG_FLEUR_HOOK,
  OG_FLEUR_KICKER,
  OG_FLEUR_SUB,
  OG_CHIP_FAST,
  OG_CHIP_FREE,
  OG_CHIP_PRIVATE,
} from '@/lib/og-share-copy'
import {
  OgBenefitChips,
  OgBrandHeader,
  OgConversionFooter,
  OgHook,
  OgKicker,
  OgSubhook,
} from '@/lib/og-share-chrome'
import { PETAL_DEFS, PETAL_COLOR_UNKNOWN_DOMINANT } from '@/lib/petal-theme'

export const dynamic = 'force-dynamic'

const W = 1200
const H = 630

function petalPath(halfLen: number, width: number): string {
  const tip = halfLen * 2
  return [
    `M 0 0`,
    `C ${-width * 1.1} ${-halfLen * 0.4}  ${-width * 0.8} ${-tip * 0.7}  0 ${-tip}`,
    `C ${width * 0.8}  ${-tip * 0.7}   ${width * 1.1}  ${-halfLen * 0.4}  0 0`,
    `Z`,
  ].join(' ')
}

function FlowerOG({ scores, dominant }: { scores: Record<string, number>; dominant: string | null }) {
  const CENTER = 120
  const SIZE = 260
  const MIN_LEN = 22
  const MAX_LEN = 88
  const PETAL_W = 24

  const vals = Object.values(scores).filter((v) => typeof v === 'number')
  const dataMax = vals.length ? Math.max(...vals) : 1
  const scale = dataMax > 0 ? dataMax : 1

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`-${CENTER} -${CENTER} ${SIZE * 2} ${SIZE * 2}`}
    >
      {PETAL_DEFS.map((p) => {
        const normalized = Math.min(1, Math.max(0, (scores[p.id] ?? 0) / scale))
        const halfLen = MIN_LEN + normalized * (MAX_LEN - MIN_LEN)
        const path = petalPath(halfLen, PETAL_W)
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

function truncate(s: string | null | undefined, max: number): string {
  if (!s) return ''
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')

  let scores: Record<string, number> = {}
  let dominant: string | null = null
  let globalText: string | null = null

  if (id && !isNaN(Number(id)) && isDbConfigured()) {
    try {
      const result = await getResult(Number(id))
      scores = (result.scores as Record<string, number>) || {}
      const analysis = result.analysis as Record<string, unknown> | undefined
      dominant = (analysis?.dominant as string) || null
      globalText = (analysis?.global as string) || null
    } catch {
      /* empty flower */
    }
  }

  const dominantDef = PETAL_DEFS.find((p) => p.id === dominant)
  const dominantColor = dominantDef?.color || PETAL_COLOR_UNKNOWN_DOMINANT
  const dominantName = dominantDef?.name || ''

  const trustChips = [OG_CHIP_FREE, OG_CHIP_PRIVATE, OG_CHIP_FAST] as const

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: W,
          height: H,
          background: 'linear-gradient(165deg, #fffbf5 0%, #f7ead8 35%, #fdf6ee 70%, #faf0e6 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -80,
            right: -70,
            width: 380,
            height: 380,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${dominantColor}18 0%, transparent 65%)`,
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -100,
            left: -40,
            width: 360,
            height: 360,
            borderRadius: '50%',
            background: 'rgba(139,92,246,0.06)',
            display: 'flex',
          }}
        />

        <OgBrandHeader variant="warm" />

        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            width: '100%',
            height: '100%',
            paddingTop: 108,
            paddingBottom: 76,
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'flex',
              width: 400,
              alignItems: 'center',
              justifyContent: 'center',
              paddingLeft: 48,
            }}
          >
            <div
              style={{
                display: 'flex',
                width: 288,
                height: 288,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.85)',
                border: `3px solid ${dominantColor}35`,
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 0 80px ${dominantColor}25, 0 16px 48px rgba(45,28,14,0.08)`,
              }}
            >
              <FlowerOG scores={scores} dominant={dominant} />
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              justifyContent: 'center',
              paddingRight: 52,
              paddingLeft: 8,
            }}
          >
            <OgKicker variant="warm">{OG_FLEUR_KICKER}</OgKicker>
            <OgHook variant="warm">{OG_FLEUR_HOOK}</OgHook>
            <OgSubhook variant="warm">{OG_FLEUR_SUB}</OgSubhook>

            {dominantName && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: dominantColor,
                    display: 'flex',
                  }}
                />
                <div
                  style={{
                    fontSize: 40,
                    fontWeight: 800,
                    color: '#1a1008',
                    lineHeight: 1.05,
                    letterSpacing: '-0.03em',
                    fontFamily:
                      'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                    display: 'flex',
                  }}
                >
                  Dimension dominante · {dominantName}
                </div>
              </div>
            )}

            {globalText && (
              <div
                style={{
                  fontSize: 18,
                  color: 'rgba(55,35,20,0.82)',
                  lineHeight: 1.5,
                  fontStyle: 'italic',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  marginBottom: 16,
                  display: 'flex',
                }}
              >
                {truncate(globalText, 125)}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <OgBenefitChips items={OG_FLEUR_CHIPS} variant="light" />
              <OgBenefitChips items={trustChips} variant="light" />
            </div>
          </div>
        </div>

        <OgConversionFooter ctaLabel={OG_FLEUR_CTA} variant="warm" />
      </div>
    ),
    { width: W, height: H }
  )
}
