/**
 * GET /api/og/dreamscape?token=…
 * Génère une image OG 1200×630 pour une Promenade Onirique partagée.
 * Utilise le snapshot stocké + overlay stylisé.
 */
import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { getShared } from '@/lib/db-dreamscape'

export const dynamic = 'force-dynamic'

const W = 1200
const H = 630
const BRAND = "Fleur d'AmOurs"

function truncate(s: string | null | undefined, max: number): string {
  if (!s) return ''
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  let snapshot: string | null = null
  let poeticReflection: string | null = null

  if (token && isDbConfigured()) {
    try {
      const data = await getShared(token)
      snapshot = (data.snapshot as string) || null
      poeticReflection = (data.poeticReflection as string) || null
      if (!poeticReflection) {
        const history = (data.history as Array<{ role?: string; content?: string }>) || []
        const closing = history.find((m) => m.role === 'closing')
        poeticReflection = closing?.content || null
      }
    } catch {
      /* fallback */
    }
  }

  const shortText = truncate(poeticReflection, 150)

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: W,
          height: H,
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'Georgia, serif',
          background: 'linear-gradient(135deg, #0a0118 0%, #150829 50%, #0a0118 100%)',
        }}
      >
        {/* Snapshot background image */}
        {snapshot && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={snapshot}
            width={W}
            height={H}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: W,
              height: H,
              objectFit: 'cover',
              opacity: 0.45,
            }}
            alt=""
          />
        )}

        {/* Gradient overlay for readability */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: snapshot
              ? 'linear-gradient(to bottom, rgba(10,1,24,0.3) 0%, rgba(10,1,24,0.55) 40%, rgba(10,1,24,0.88) 100%)'
              : 'transparent',
            display: 'flex',
          }}
        />

        {/* Decorative ambient blobs */}
        <div
          style={{
            position: 'absolute',
            top: -80,
            right: 100,
            width: 350,
            height: 350,
            borderRadius: '50%',
            background: 'rgba(139,92,246,0.12)',
            filter: 'blur(80px)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 60,
            left: 80,
            width: 280,
            height: 280,
            borderRadius: '50%',
            background: 'rgba(236,72,153,0.1)',
            filter: 'blur(70px)',
            display: 'flex',
          }}
        />

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            justifyContent: 'flex-end',
            padding: '0 64px 80px',
            position: 'relative',
          }}
        >
          {/* Title badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 18,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'rgba(196,181,253,0.9)',
                display: 'flex',
              }}
            />
            <div
              style={{
                fontSize: 13,
                color: 'rgba(196,181,253,0.8)',
                letterSpacing: '3px',
                textTransform: 'uppercase',
                display: 'flex',
              }}
            >
              Promenade Onirique
            </div>
          </div>

          {/* Poetic text */}
          {shortText ? (
            <div
              style={{
                fontSize: 28,
                fontWeight: 400,
                color: 'rgba(255,255,255,0.92)',
                lineHeight: 1.5,
                fontStyle: 'italic',
                marginBottom: 10,
                display: 'flex',
              }}
            >
              &ldquo;{shortText}&rdquo;
            </div>
          ) : (
            <div
              style={{
                fontSize: 42,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.9)',
                lineHeight: 1.2,
                marginBottom: 10,
                display: 'flex',
              }}
            >
              Une Promenade Onirique
            </div>
          )}
        </div>

        {/* Footer bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 60,
            background: 'rgba(0,0,0,0.6)',
            borderTop: '1px solid rgba(139,92,246,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 56px',
          }}
        >
          <div style={{ fontSize: 17, color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 8 }}>
            🌸 <span>{BRAND}</span>
          </div>
          <div style={{ fontSize: 15, color: 'rgba(196,181,253,0.85)', display: 'flex', alignItems: 'center' }}>
            Vivre ma propre promenade →
          </div>
        </div>
      </div>
    ),
    { width: W, height: H }
  )
}
