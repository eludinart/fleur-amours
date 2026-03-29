/**
 * POST /api/translate — Proxy LibreTranslate.
 * Requiert un utilisateur connecté pour éviter l'abus de quota.
 * Limite la taille du texte à 5 000 caractères.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiError } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

const MAX_TEXT_LENGTH = 5_000

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const text = String(body.text ?? body.q ?? '').slice(0, MAX_TEXT_LENGTH)
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
