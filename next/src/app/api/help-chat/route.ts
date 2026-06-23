/**
 * POST /api/help-chat
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isLlmConfigured } from '@/lib/llm'
import { getLangInstruction } from '@/lib/prompts'
import { buildSystemPrompt } from '@/lib/ai-system-prompt'
import { AiAccessDeniedError, aiAccessErrorResponse, guardedLlmCall } from '@/lib/ai-guard'

export const dynamic = 'force-dynamic'

const HELP_SYSTEM = `Tu es l'assistant du Jardin Fleur d'AmOurs. Tu réponds de façon courte et utile aux questions sur l'application.`

export async function POST(req: NextRequest) {
  let userId: string
  try {
    ;({ userId } = await requireAuth(req))
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Authentification requise' }, { status: e.status ?? 401 })
  }
  const uid = parseInt(userId, 10)

  try {
    const body = await req.json().catch(() => ({}))
    const message = String(body.message ?? '').trim()
    const history = Array.isArray(body.history) ? body.history : []
    const locale = req.headers.get('x-locale') || 'fr'

    if (!message) {
      return NextResponse.json({ reply: '' })
    }

    if (!(await isLlmConfigured())) {
      return NextResponse.json({
        reply: "L'assistant n'est pas configuré. Contactez l'équipe.",
      })
    }

    const messages = history
      .filter((m: { role?: string; content?: string }) => m.role && m.content)
      .map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: String(m.content),
      }))
    messages.push({
      role: 'user' as const,
      content: message + getLangInstruction(locale),
    })

    const system = await buildSystemPrompt({
      taskId: 'help-chat',
      basePrompt: HELP_SYSTEM,
      locale,
    })

    const { result } = await guardedLlmCall({
      taskId: 'help-chat',
      userId: uid,
      system,
      messages,
      options: { maxTokens: 600, rawText: true },
    })

    const reply =
      typeof result === 'string' && result.trim()
        ? result.trim()
        : "Je n'ai pas pu générer une réponse. Réessayez."

    return NextResponse.json({ reply })
  } catch (e: unknown) {
    if (e instanceof AiAccessDeniedError) return aiAccessErrorResponse(e.result)
    return NextResponse.json({ reply: 'Erreur serveur.' })
  }
}
