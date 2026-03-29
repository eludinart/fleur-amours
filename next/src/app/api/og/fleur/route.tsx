/**
 * GET /api/og/fleur?id=…
 * Génère une image OG 1200×630 pour un résultat de la Fleur d'AmOurs.
 */
import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { getResult } from '@/lib/db-fleur'

export const dynamic = 'force-dynamic'

const W = 1200
const H = 630
const BRAND = "Fleur d'AmOurs"

const PETAL_DEFS = [
  { id: 'agape',     name: 'Agapè',     angle: 0,   color: '#f43f5e' },
  { id: 'philautia', name: 'Philautia', angle: 45,  color: '#f59e0b' },
  { id: 'mania',     name: 'Mania',     angle: 90,  color: '#ef4444' },
  { id: 'storge',    name: 'Storgè',    angle: 135, color: '#0d9488' },
  { id: 'pragma',    name: 'Pragma',    angle: 180, color: '#6366f1' },
  { id: 'philia',    name: 'Philia',    angle: 225, color: '#10b981' },
  { id: 'ludus',     name: 'Ludus',     angle: 270, color: '#0ea5e9' },
  { id: 'eros',      name: 'Éros',      angle: 315, color: '#8b5cf6' },
]

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
  const SIZE = 240
  const MIN_LEN = 20
  const MAX_LEN = 80
  const PETAL_W = 22

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
              opacity={isHigh ? 0.95 : 0.65}
              stroke={p.color}
              strokeWidth={isHigh ? 1.5 : 0.5}
              strokeOpacity={0.4}
            />
          </g>
        )
      })}
      {/* Center circle */}
      <circle cx={0} cy={0} r={14} fill="white" opacity={0.9} />
      <circle cx={0} cy={0} r={8} fill="#f8f4ef" />
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
      /* fallback to empty flower */
    }
  }

  const dominantDef = PETAL_DEFS.find((p) => p.id === dominant)
  const dominantColor = dominantDef?.color || '#8b5cf6'
  const dominantName = dominantDef?.name || ''

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: W,
          height: H,
          background: 'linear-gradient(135deg, #fdf8f0 0%, #f5e6d0 40%, #fdf4ee 100%)',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'Georgia, serif',
        }}
      >
        {/* Decorative soft circles */}
        <div
          style={{
            position: 'absolute',
            top: -60,
            left: -60,
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'rgba(244,63,94,0.07)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -80,
            right: -80,
            width: 360,
            height: 360,
            borderRadius: '50%',
            background: 'rgba(139,92,246,0.06)',
            display: 'flex',
          }}
        />

        {/* Left: Flower */}
        <div
          style={{
            display: 'flex',
            width: 380,
            alignItems: 'center',
            justifyContent: 'center',
            paddingLeft: 60,
          }}
        >
          <div
            style={{
              display: 'flex',
              width: 260,
              height: 260,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.7)',
              border: `2px solid ${dominantColor}22`,
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 60px ${dominantColor}22, 0 8px 32px rgba(0,0,0,0.06)`,
            }}
          >
            <FlowerOG scores={scores} dominant={dominant} />
          </div>
        </div>

        {/* Right: Text */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
            paddingRight: 60,
            paddingLeft: 20,
            gap: 0,
          }}
        >
          {/* Label */}
          <div
            style={{
              fontSize: 13,
              color: 'rgba(100,60,40,0.6)',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              marginBottom: 14,
              display: 'flex',
            }}
          >
            Ma Fleur d'AmOurs
          </div>

          {/* Dominant petal */}
          {dominantName && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: dominantColor,
                  display: 'flex',
                }}
              />
              <div
                style={{
                  fontSize: 52,
                  fontWeight: 700,
                  color: '#2d1c0e',
                  lineHeight: 1.1,
                  letterSpacing: '-0.5px',
                  display: 'flex',
                }}
              >
                {dominantName}
              </div>
            </div>
          )}

          {/* Global text */}
          {globalText && (
            <div
              style={{
                fontSize: 19,
                color: 'rgba(70,40,20,0.8)',
                lineHeight: 1.5,
                fontStyle: 'italic',
                marginBottom: 28,
                display: 'flex',
              }}
            >
              {truncate(globalText, 130)}
            </div>
          )}

          {/* 8 petal mini scores */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            {PETAL_DEFS.map((p) => {
              const val = scores[p.id] ?? 0
              return (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    background: `${p.color}15`,
                    border: `1px solid ${p.color}30`,
                    borderRadius: 999,
                    padding: '3px 10px',
                    fontSize: 12,
                    color: p.id === dominant ? p.color : 'rgba(80,50,30,0.75)',
                    fontWeight: p.id === dominant ? 700 : 400,
                  }}
                >
                  {p.name} · {val}
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 60,
            background: 'rgba(255,255,255,0.8)',
            borderTop: '1px solid rgba(180,120,80,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 56px',
          }}
        >
          <div style={{ fontSize: 17, color: 'rgba(80,50,30,0.75)', display: 'flex', alignItems: 'center', gap: 8 }}>
            🌸 <span>{BRAND}</span>
          </div>
          <div style={{ fontSize: 15, color: dominantColor, display: 'flex', alignItems: 'center' }}>
            Découvrir ma propre Fleur →
          </div>
        </div>
      </div>
    ),
    { width: W, height: H }
  )
}
