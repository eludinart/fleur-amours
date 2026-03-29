/**
 * POST /api/ai/dreamscape_summarize
 * Résumé poétique de la conversation Dreamscape.
 * Résumé Dreamscape via OpenRouter.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiError } from '@/lib/api-auth'
import { openrouterCall } from '@/lib/openrouter'
import { getLangInstruction } from '@/lib/prompts'

export const dynamic = 'force-dynamic'

function getLocale(req: NextRequest): string {
  return req.headers.get('x-locale') || 'fr'
}

const DREAMSCAPE_SUMMARIZE_SYSTEM = `Tu es le Tuteur maïeutique du jardin intérieur. À partir de la conversation et du contexte du tirage ci-dessous, génère un résumé détaillé et riche (8 à 15 phrases) du parcours. Inclus :
- L'évolution des échanges et des thèmes abordés
- Le climat intérieur et ce qui a émergé (intentions, tensions, joies)
- Les cartes et leur sens dans les positions (Agapè, Philautia, etc.) si présentes
- La trajectoire et ce qu'elle révèle
- Les pétales de la fleur marqués et leur signification
- Les actions ou engagements repérés
Ton chaleureux et poétique, sans conseil direct. Sépare les paragraphes par une ligne vide (double saut de ligne) pour une lecture agréable. Réponds UNIQUEMENT en texte brut, sans JSON.`

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({
      summary: 'Aucun échange à résumer.',
    })
  }

  let body: {
    history?: Array<{ role?: string; content?: string }>
    slots?: Array<{ position?: string; card?: string; faceDown?: boolean }>
    petals?: Record<string, number>
    path?: string[]
    actions?: string[]
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ summary: 'Aucun échange à résumer.' })
  }

  const history = Array.isArray(body.history) ? body.history : []
  const slots = Array.isArray(body.slots) ? body.slots : []
  const petals =
    body.petals && typeof body.petals === 'object' ? body.petals : {}
  const path = Array.isArray(body.path) ? body.path : []
  const actions = Array.isArray(body.actions) ? body.actions : []

  if (history.length === 0) {
    return NextResponse.json({ summary: 'Aucun échange à résumer.' })
  }

  let convText = ''
  for (const m of history) {
    const role = (m.role ?? 'user') === 'closing' ? 'user' : m.role ?? 'user'
    const content = String(m.content ?? '').trim()
    if (content) {
      convText +=
        (role === 'user' ? 'Utilisateur: ' : 'IA: ') + content + '\n'
    }
  }

  const ctx: string[] = []
  if (slots.length > 0) {
    const cartes = slots.map((s) => {
      const pos = s.position ?? '?'
      const card = s.card ?? '?'
      const hidden = s.faceDown ? ' (cachée)' : ''
      return `${pos}: ${card}${hidden}`
    })
    ctx.push('Cartes et positions:\n' + cartes.join('\n'))
  }
  if (path.length > 0) {
    ctx.push('Trajectoire (ordre de révélation): ' + path.join(' → '))
  }
  if (Object.keys(petals).length > 0) {
    const labels: Record<string, string> = {
      agape: 'Agapè',
      philautia: 'Philautia',
      mania: 'Mania',
      storge: 'Storgè',
      pragma: 'Pragma',
      philia: 'Philia',
      ludus: 'Ludus',
      eros: 'Éros',
    }
    const pLines: string[] = []
    for (const [k, v] of Object.entries(petals)) {
      const num = Number(v)
      if (!isNaN(num) && num > 0.05) {
        pLines.push(`${labels[k] ?? k}: ${Math.round(num * 100)}%`)
      }
    }
    if (pLines.length > 0) {
      ctx.push('Fleur (intensités des pétales):\n' + pLines.join(', '))
    }
  }
  if (actions.length > 0) {
    ctx.push('Actions identifiées: ' + actions.join(' ; '))
  }

  const contextBlock =
    ctx.length > 0
      ? '\n\nContexte du tirage:\n' + ctx.join('\n\n')
      : ''

  const userContent =
    'Conversation:\n' +
    convText.trim() +
    contextBlock +
    '\n\n' +
    getLangInstruction(getLocale(req))

  const result = await openrouterCall(
    DREAMSCAPE_SUMMARIZE_SYSTEM,
    [{ role: 'user', content: userContent }],
    { maxTokens: 800, rawText: true }
  )

  const summary =
    typeof result === 'string' && result.trim()
      ? result.trim()
      : 'Cette promenade onirique a nourri le jardin intérieur.'

  return NextResponse.json({ summary })
}
