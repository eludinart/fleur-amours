/**
 * POST /api/help-chat
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { openrouterCall } from '@/lib/openrouter'
import { appendManuelReferenceToSystem } from '@/lib/manuel-ai-corpus'
import { getLangInstruction } from '@/lib/prompts'

export const dynamic = 'force-dynamic'

const HELP_SYSTEM = `Tu es l'assistant du Jardin Fleur d'AmOurs. Tu réponds de façon courte et utile aux questions sur l'application.`

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Authentification requise' }, { status: e.status ?? 401 })
  }
  try {
    const body = await req.json().catch(() => ({}))
    const message = String(body.message ?? '').trim()
    const history = Array.isArray(body.history) ? body.history : []
    const locale = req.headers.get('x-locale') || 'fr'

    if (!message) {
      return NextResponse.json({ reply: '' })
    }

    if (!process.env.OPENROUTER_API_KEY) {
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

    const result = await openrouterCall(
      appendManuelReferenceToSystem(HELP_SYSTEM, { retrievalQuery: message, maxChars: 10_000 }),
      messages,
      {
        maxTokens: 600,
        rawText: true,
      },
    )

    const reply =
      typeof result === 'string' && result.trim()
        ? result.trim()
        : "Je n'ai pas pu générer une réponse. Réessayez."

    return NextResponse.json({ reply })
  } catch {
    return NextResponse.json({ reply: 'Erreur serveur.' })
  }
}
