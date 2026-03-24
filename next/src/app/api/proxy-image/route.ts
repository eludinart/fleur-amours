/**
 * GET /api/proxy-image
 * Proxy image pour contourner CORS (WebGL/Canvas).
 */
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url') ?? ''
  if (!url || !/^https?:\/\/(?:www\.)?eludein\.art\//i.test(url)) {
    return NextResponse.json({ error: 'URL invalide ou domaine non autorisé' }, { status: 400 })
  }
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Fleur-AmOurs/1.0' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      return NextResponse.json({ error: `HTTP ${res.status}` }, { status: res.status })
    }
    const contentType = res.headers.get('content-type') || 'image/png'
    const buffer = await res.arrayBuffer()
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur proxy' },
      { status: 502 }
    )
  }
}
