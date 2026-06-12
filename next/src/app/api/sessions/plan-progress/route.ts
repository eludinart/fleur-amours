/**
 * POST /api/sessions/plan-progress
 * Met à jour la progression du plan 14 jours d'une session (étapes complétées,
 * bilan de fin). La progression est fusionnée côté serveur dans `step_data`
 * (clé `plan14j_progress`) sans écraser les autres blocs (règle cache IA).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { isDbConfigured } from '@/lib/db'
import { getById, update } from '@/lib/db-sessions'
import { recordTimelineEvent } from '@/lib/db-timeline'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const body = (await req.json().catch(() => ({}))) as {
      id?: number | string
      completed?: number[]
      bilan?: string
    }
    const sessionId = parseInt(String(body.id ?? 0), 10)
    if (!sessionId) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const user = await authMe(uid)
    const email = user.email || ''
    const session = await getById(sessionId, email)
    if (!session) {
      return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
    }

    const completed = Array.isArray(body.completed)
      ? Array.from(new Set(body.completed.map((n) => parseInt(String(n), 10)).filter((n) => Number.isFinite(n))))
      : []

    // Total d'étapes attendu, pour détecter la complétion.
    const plan = session.plan14j as { plan_14j?: unknown[] } | null
    const totalDays = Array.isArray(plan?.plan_14j) ? plan!.plan_14j!.length : 0

    // Fusion : conserver step_data existant + bloc plan14j_progress.
    const existingStepData =
      session.step_data && typeof session.step_data === 'object'
        ? (session.step_data as Record<string, unknown>)
        : {}
    const prevProgress =
      (existingStepData.plan14j_progress as { bilan?: string; completedAt?: string } | undefined) ?? {}

    const isComplete = totalDays > 0 && completed.length >= totalDays
    const progress = {
      completed,
      bilan: typeof body.bilan === 'string' ? body.bilan.slice(0, 2000) : prevProgress.bilan ?? null,
      completedAt: isComplete ? prevProgress.completedAt ?? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    }

    const mergedStepData = { ...existingStepData, plan14j_progress: progress }

    await update({ id: sessionId, step_data: mergedStepData })

    // Timeline : marquer la complétion du plan une seule fois.
    if (isComplete && !prevProgress.completedAt) {
      void recordTimelineEvent({
        userId: uid,
        source: 'session',
        refId: sessionId,
        title: 'Plan 14 jours terminé',
        summary: progress.bilan ? String(progress.bilan).slice(0, 280) : null,
      }).catch(() => {})
    }

    return NextResponse.json({ saved: true, progress })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message || 'Erreur' }, { status: e.status || 401 })
  }
}
