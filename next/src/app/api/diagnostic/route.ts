/**
 * POST /api/diagnostic
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { runSystemicDiagnostic } from '@/lib/diagnostic-engine'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const result = await runSystemicDiagnostic({
      coeur: body.coeur as Record<string, number | undefined> | undefined,
      temps: body.temps as string | undefined,
      climat: body.climat as string | undefined,
      histoire: body.histoire as string | undefined,
      mode: body.mode as string | undefined,
    })
    return NextResponse.json(result)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
