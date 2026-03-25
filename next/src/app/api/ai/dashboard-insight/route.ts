/**
 * POST /api/ai/dashboard-insight
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { generateScienceProfile } from '@/lib/science-generator'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)

    const body = (await req.json().catch(() => ({}))) as {
      petals?: Record<string, number>
      locale?: string
    }

    const petals = body.petals ?? {}
    const locale = (body.locale ?? 'fr').toLowerCase()

    const userIdNum = parseInt(userId, 10)
    const user = await authMe(userIdNum)

    const result = await generateScienceProfile({
      userId: userIdNum,
      userEmail: user.email,
      locale,
      petals,
    })

    return NextResponse.json(result)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
