/**
 * GET /api/og/email-fleur?s=…
 * Fleur PNG carrée pour les e-mails (param s = scores JSON en base64url).
 */
import { NextRequest, NextResponse } from 'next/server'
import { decodeScoresForEmailFlower } from '@/lib/email-flower-url'
import { normalizePetalsForEmail } from '@/lib/email-flower-svg'
import { renderEmailFlowerPng } from '@/lib/email-flower-png'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const encoded = req.nextUrl.searchParams.get('s') ?? ''
  const rawScores = decodeScoresForEmailFlower(encoded)
  const scores = normalizePetalsForEmail(rawScores)
  const png = await renderEmailFlowerPng(scores)

  return new NextResponse(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
      'Content-Disposition': 'inline; filename="fleur-email.png"',
    },
  })
}
