import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { getSharedImage } from '@/lib/db-dreamscape'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const token = req.nextUrl.searchParams.get('token')?.trim()
    if (!token) {
      return NextResponse.json({ error: 'Token requis' }, { status: 400 })
    }
    const data = await getSharedImage(token)
    if (!data) {
      return NextResponse.json({ error: 'Image introuvable' }, { status: 404 })
    }
    const buf = Buffer.from(data.base64, 'base64')
    return new NextResponse(buf, {
      headers: {
        'Content-Type': data.mime,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Image introuvable' }, { status: 404 })
  }
}
