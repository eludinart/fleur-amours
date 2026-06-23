/**
 * POST /api/ai/landing-reading — lecture personnalisée carte + intention (public, invité).
 */
import { NextRequest, NextResponse } from 'next/server'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { generateLandingReading } from '@/lib/landing-reading'

export const dynamic = 'force-dynamic'

const RATE = { limit: 25, windowMs: 3_600_000 }

function resolveLocale(req: NextRequest, bodyLocale?: string): string {
  const header = req.headers.get('x-locale') || req.headers.get('X-Locale')
  return String(bodyLocale ?? header ?? 'fr')
    .toLowerCase()
    .slice(0, 5)
}

export async function POST(req: NextRequest) {
  const limited = rateLimit('landing-reading', clientIp(req), RATE)
  if (limited) return limited

  try {
    const body = (await req.json().catch(() => ({}))) as {
      cardName?: string
      essence?: string
      lumiere?: string
      rootQuestion?: string
      intention?: string
      locale?: string
    }

    const cardName = String(body.cardName ?? '').trim()
    if (!cardName) {
      return NextResponse.json({ error: 'cardName requis' }, { status: 422 })
    }

    const result = await generateLandingReading({
      cardName,
      essence: body.essence,
      lumiere: body.lumiere,
      rootQuestion: body.rootQuestion,
      intention: body.intention,
      locale: resolveLocale(req, body.locale),
    })

    return NextResponse.json(result)
  } catch (err: unknown) {
    const e = err as { message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: 500 })
  }
}
