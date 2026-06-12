/**
 * GET /api/science/view/:filename
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { viewScienceFile } from '@/lib/science-files'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ filename: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    await requireAuth(req)
    const { filename } = await ctx.params
    const result = await viewScienceFile(filename)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
