/**
 * GET  /api/mycelium/interview — thématiques + entretien en cours + historique salarié
 * POST /api/mycelium/interview — start | reply | complete | abandon
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireMyceliumMember } from '@/lib/mycelium-auth'
import { isDbConfigured } from '@/lib/db'
import {
  abandonInterview,
  completeInterview,
  createInterview,
  getActiveInterview,
  getInterviewById,
  listRecentInterviews,
  updateInterviewMessages,
  type InterviewMessage,
} from '@/lib/db-mycelium-interviews'
import { saveWorkCheckin } from '@/lib/db-mycelium'
import { MYCELIUM_INTERVIEW_TOPICS, getInterviewTopic } from '@/lib/mycelium-interview-topics'
import { buildOpeningTurn, generateInterviewTurn } from '@/lib/mycelium-interview-ai'

export const dynamic = 'force-dynamic'

function resolveLocale(req: NextRequest, bodyLocale?: string): string {
  return bodyLocale?.slice(0, 5) || req.headers.get('x-locale')?.slice(0, 5) || 'fr'
}

function toDto(interview: Awaited<ReturnType<typeof getInterviewById>>) {
  if (!interview) return null
  return {
    id: interview.id,
    topicSlug: interview.topicSlug,
    topicLabel: interview.topicLabel,
    status: interview.status,
    messages: interview.messages,
    closure: interview.closure,
    createdAt: interview.createdAt,
    completedAt: interview.completedAt,
  }
}

export async function GET(req: NextRequest) {
  try {
    const { uid, org } = await requireMyceliumMember(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ topics: MYCELIUM_INTERVIEW_TOPICS.map((t) => ({ slug: t.slug, labelKey: t.labelKey, introKey: t.introKey, dimensions: t.dimensions })), active: null, recent: [] })
    }

    const [active, recent] = await Promise.all([
      getActiveInterview(uid, org.id),
      listRecentInterviews(uid, org.id, 6),
    ])

    return NextResponse.json({
      topics: MYCELIUM_INTERVIEW_TOPICS.map((t) => ({
        slug: t.slug,
        labelKey: t.labelKey,
        introKey: t.introKey,
        dimensions: t.dimensions,
      })),
      active: toDto(active),
      recent: recent.map((r) => toDto(r)),
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { uid, org, membership } = await requireMyceliumMember(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      action?: string
      topicSlug?: string
      sessionId?: number
      message?: string
      locale?: string
      mood?: number
      note?: string
    }
    const locale = resolveLocale(req, body.locale)
    const action = body.action || 'start'

    if (action === 'start') {
      const topic = getInterviewTopic(String(body.topicSlug || ''))
      if (!topic) return NextResponse.json({ error: 'Thématique invalide' }, { status: 400 })

      const existing = await getActiveInterview(uid, org.id)
      if (existing) {
        return NextResponse.json({ session: toDto(existing), resumed: true })
      }

      const opening = buildOpeningTurn(topic)
      const now = new Date().toISOString()
      const initialMessages: InterviewMessage[] = [
        {
          role: 'assistant',
          content: [opening.acknowledgment, opening.question].filter(Boolean).join('\n\n'),
          at: now,
        },
      ]

      const session = await createInterview({
        userId: uid,
        orgId: org.id,
        teamId: membership.teamId,
        topicSlug: topic.slug,
        topicLabel: topic.labelFr,
        initialMessages,
      })

      return NextResponse.json({
        session: toDto(session),
        turn: opening,
      })
    }

    if (action === 'reply') {
      const sessionId = parseInt(String(body.sessionId ?? 0), 10)
      const message = String(body.message ?? '').trim()
      if (!sessionId || !message) {
        return NextResponse.json({ error: 'Message requis' }, { status: 400 })
      }

      const session = await getInterviewById(sessionId, uid)
      if (!session || session.status !== 'in_progress') {
        return NextResponse.json({ error: 'Entretien introuvable' }, { status: 404 })
      }

      const now = new Date().toISOString()
      const messages: InterviewMessage[] = [
        ...session.messages,
        { role: 'user', content: message, at: now },
      ]

      const turn = await generateInterviewTurn({
        topicSlug: session.topicSlug,
        orgName: org.name,
        locale,
        messages: session.messages,
        userMessage: message,
      })

      const assistantParts = [turn.acknowledgment]
      if (turn.question) assistantParts.push(turn.question)
      if (turn.proposeClose && turn.closureMessage) assistantParts.push(turn.closureMessage)

      messages.push({
        role: 'assistant',
        content: assistantParts.filter(Boolean).join('\n\n'),
        at: new Date().toISOString(),
      })

      await updateInterviewMessages(sessionId, uid, messages)

      return NextResponse.json({
        session: toDto(await getInterviewById(sessionId, uid)),
        turn,
      })
    }

    if (action === 'complete') {
      const sessionId = parseInt(String(body.sessionId ?? 0), 10)
      if (!sessionId) return NextResponse.json({ error: 'Session requise' }, { status: 400 })

      const session = await getInterviewById(sessionId, uid)
      if (!session || session.status !== 'in_progress') {
        return NextResponse.json({ error: 'Entretien introuvable' }, { status: 404 })
      }

      const mood = Math.min(5, Math.max(1, parseInt(String(body.mood ?? 3), 10) || 3))
      const note = String(body.note ?? '').trim().slice(0, 500)

      const completed = await completeInterview(sessionId, uid, {
        mood,
        employeeSummary: note || 'Entretien bien-être enregistré.',
        pulseNote: note || `Entretien : ${session.topicLabel}`,
        dimensions: getInterviewTopic(session.topicSlug)?.dimensions ?? [],
        provider: 'employee',
      })

      const checkin = await saveWorkCheckin({
        userId: uid,
        mood,
        note: note || `Entretien bien-être — ${session.topicLabel}`,
      })

      return NextResponse.json({
        session: toDto(completed),
        checkin: { id: checkin.id, mood: checkin.mood, createdAt: checkin.createdAt },
        saved: true,
      })
    }

    if (action === 'abandon') {
      const sessionId = parseInt(String(body.sessionId ?? 0), 10)
      if (sessionId) await abandonInterview(sessionId, uid)
      return NextResponse.json({ abandoned: true })
    }

    return NextResponse.json({ error: 'Action invalide' }, { status: 400 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
