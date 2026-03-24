/**
 * GET /api/fleur/questions/[slug]
 * Récupère les questions Fleur d'AmOurs depuis MariaDB.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { getQuestions } from '@/lib/db-fleur'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    if (!slug) {
      return NextResponse.json({ error: 'slug required' }, { status: 400 })
    }

    const locale =
      req.nextUrl.searchParams.get('locale') ?? 'fr'
    const validLocale = ['fr', 'en', 'es'].includes(locale) ? (locale as 'fr' | 'en' | 'es') : 'fr'

    if (!isDbConfigured()) {
      return NextResponse.json(
        { error: 'Backend non configuré (MARIADB_*)' },
        { status: 503 }
      )
    }

    const questions = await getQuestions(slug, validLocale)
    return NextResponse.json(questions)
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e.status ?? 500
    return NextResponse.json(
      { error: e.message ?? 'Erreur lors du chargement des questions' },
      { status }
    )
  }
}
