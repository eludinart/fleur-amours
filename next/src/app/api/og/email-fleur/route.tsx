/**
 * GET /api/og/email-fleur?s=…
 * Fleur PNG carrée pour les e-mails (param s = scores JSON en base64url).
 */
import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { decodeScoresForEmailFlower } from '@/lib/email-flower-url'
import { dominantPetalFromScores, normalizePetalsForEmail } from '@/lib/email-flower-svg'
import { OgFlowerGraphic } from '@/lib/og-flower-graphic'

export const dynamic = 'force-dynamic'

const SIZE = 400

export async function GET(req: NextRequest) {
  const encoded = req.nextUrl.searchParams.get('s') ?? ''
  const rawScores = decodeScoresForEmailFlower(encoded)
  const scores = normalizePetalsForEmail(rawScores)
  const dominant = dominantPetalFromScores(scores)?.id ?? null

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: SIZE,
          height: SIZE,
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at 50% 55%, #fff5f7 0%, #ffffff 72%)',
        }}
      >
        <OgFlowerGraphic
          scores={scores}
          dominant={dominant}
          size={340}
          center={120}
          minLen={18}
          maxLen={76}
          petalWidth={20}
        />
      </div>
    ),
    {
      width: SIZE,
      height: SIZE,
      headers: {
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
        'Content-Disposition': 'inline; filename="fleur-email.png"',
      },
    }
  )
}
