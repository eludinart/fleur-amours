/**
 * POST /api/translate
 */
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const text = body.text ?? body.q ?? ''
    if (!text) {
      return NextResponse.json({ translatedText: '' })
    }
    const url = process.env.LIBRETRANSLATE_URL || 'https://libretranslate.com'
    const apiKey = process.env.LIBRETRANSLATE_API_KEY
    const res = await fetch(`${url}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: body.source || 'auto',
        target: body.target || 'fr',
        ...(apiKey && { api_key: apiKey }),
      }),
    })
    if (!res.ok) {
      return NextResponse.json({ translatedText: text })
    }
    const data = await res.json()
    return NextResponse.json({
      translatedText: data.translatedText ?? text,
    })
  } catch {
    return NextResponse.json({ translatedText: '' })
  }
}
