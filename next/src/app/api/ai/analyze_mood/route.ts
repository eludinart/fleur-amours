/**
 * POST /api/ai/analyze_mood
 * Analyse maïeutique du message utilisateur (Dreamscape).
 * Prompts et logique IA.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getLlmMetaForTask, isLlmConfigured } from '@/lib/llm'
import { AiAccessDeniedError, guardedLlmCall } from '@/lib/ai-guard'
import { getAnalyzeMoodPrompt } from '@/lib/prompts-resolver'
import { getLangInstruction, isValidPetal, isValidCard } from '@/lib/prompts'
import { parseDreamscapeConfigFromPrompt } from '@/lib/dreamscape-config'

export const dynamic = 'force-dynamic'

function getLocale(req: NextRequest): string {
  return req.headers.get('x-locale') || 'fr'
}

const PETAL_NAMES = [
  'agape',
  'philautia',
  'mania',
  'storge',
  'pragma',
  'philia',
  'ludus',
  'eros',
]

function mockResponse(reason: string) {
  return {
    poetic_reflection:
      'Je t’écoute encore. Dis-moi en une phrase ce qui est le plus vivant en toi maintenant ?',
    active_petals: {},
    petals_deficit: {},
    shadow_detected: false,
    shadow_level: 0,
    shadow_urgent: false,
    shadow_card: null,
    cards_to_reveal: [] as string[],
    card_to_replace: null,
    propose_close: false,
    propose_close_actions: [] as string[],
    provider: 'node-mock',
    degraded: true,
    _ai_error: reason,
  }
}

export async function POST(req: NextRequest) {
  let userId: string
  try {
    ;({ userId } = await requireAuth(req))
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Authentification requise' }, { status: e.status ?? 401 })
  }
  const uid = parseInt(userId, 10)

  if (!(await isLlmConfigured())) {
    return NextResponse.json(mockResponse('IA non configurée'))
  }

  let body: {
    text?: string
    history?: Array<{ role?: string; content?: string }>
    card_positions?: Record<string, string>
    all_revealed?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(mockResponse('Corps de requête invalide'))
  }

  const text = String(body.text ?? '').trim()
  const history = Array.isArray(body.history) ? body.history : []
  const cardPositions = body.card_positions ?? {}
  const allRevealed = !!body.all_revealed

  if (!text) {
    return NextResponse.json({ poetic_reflection: '' })
  }

  const locale = getLocale(req)

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (const h of history) {
    const role = h.role ?? ''
    const content = String(h.content ?? '').trim()
    if (
      (role === 'user' || role === 'assistant') &&
      content
    ) {
      messages.push({ role, content })
    }
  }

  let userMsg = text
  const userTurns = history.filter((m) => (m.role ?? '') === 'user').length
  if (userTurns <= 1) {
    userMsg +=
      "\n[Nouvelle conversation intérieure — choisis des cartes variées, évite La Tige et Le Bouton si tu les as déjà souvent proposées.]"
  }
  userMsg += `\n[Conversation intérieure — tours utilisateur déjà effectués: ${userTurns}]`
  if (Object.keys(cardPositions).length > 0) {
    const lines = Object.entries(cardPositions).map(
      ([pos, carte]) => `${pos}:${carte}`
    )
    userMsg += `\n[Fleur actuelle — ${lines.join(', ')}]`
    if (allRevealed) {
      userMsg +=
        "\n[Toutes les cartes sont à l'endroit — tu peux proposer 1 remplacement pertinent si la dynamique de l'échange l'appelle.]"
    }
  }
  userMsg += getLangInstruction(locale)
  messages.push({ role: 'user', content: userMsg })

  const systemPrompt = await getAnalyzeMoodPrompt().catch((err) => {
    console.error('[analyze_mood] prompt:', err)
    return null
  })
  if (!systemPrompt) {
    return NextResponse.json(mockResponse('Prompt Dreamscape indisponible'))
  }
  const dreamscapeConfig = parseDreamscapeConfigFromPrompt(systemPrompt)
  let result: Record<string, unknown> | string | null = null
  try {
    const guarded = await guardedLlmCall({
      taskId: 'analyze-mood',
      userId: uid,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      options: {
        maxTokens: dreamscapeConfig.max_tokens ?? 700,
        responseFormatJson: true,
      },
    })
    result = guarded.result
  } catch (e: unknown) {
    if (e instanceof AiAccessDeniedError) {
      // Soft-degrade : le parcours reste jouable (toast côté client via _ai_error)
      console.warn('[analyze_mood] accès limité:', e.result.code, e.result.reason)
      return NextResponse.json(
        mockResponse(e.result.reason ?? e.message ?? 'Accès IA limité')
      )
    }
    console.error('[analyze_mood] llm:', e)
    return NextResponse.json(mockResponse('Erreur appel IA'))
  }

  // Accepte phrase OU poetic_reflection (formats legacy / overrides admin).
  const asObj =
    result && typeof result === 'object' && !Array.isArray(result)
      ? (result as Record<string, unknown>)
      : null
  const phraseSource = asObj ? (asObj.phrase ?? asObj.poetic_reflection) : null
  const phraseRaw = phraseSource != null ? String(phraseSource).trim() : ''

  if (asObj && phraseRaw) {
    const r = asObj
    const phrase = phraseRaw
    const question = String(r.question ?? r.open_question ?? '').trim()

    const activePetals: Record<string, number> = {}
    const petalsArr = Array.isArray(r.petals) ? r.petals : []
    const tr = (s: string) =>
      s
        .toLowerCase()
        .replace(/è/g, 'e')
        .replace(/é/g, 'e')
        .replace(/à/g, 'a')
        .replace(/â/g, 'a')
        .replace(/ê/g, 'e')
        .replace(/î/g, 'i')
        .replace(/ô/g, 'o')
        .replace(/û/g, 'u')
        .replace(/ü/g, 'u')
        .replace(/ç/g, 'c')
        .replace(/œ/g, 'oe')
        .replace(/[^a-z]/g, '')

    // Keep only the most salient 1-3 petals per turn.
    const uniquePetals: string[] = []
    for (const p of petalsArr) {
      const key = tr(String(p))
      if (!PETAL_NAMES.includes(key)) continue
      if (!uniquePetals.includes(key)) uniquePetals.push(key)
      if (uniquePetals.length >= 3) break
    }
    uniquePetals.forEach((k, idx) => {
      activePetals[k] = idx === 0 ? 0.9 : idx === 1 ? 0.65 : 0.45
    })

    let shadowCard: string | null = String(r.shadow_card ?? '').trim() || null
    if (shadowCard && !isValidPetal(shadowCard)) shadowCard = null

    let cardToReplace: string | null = String(r.card_to_replace ?? '').trim() || null
    if (cardToReplace && !isValidCard(cardToReplace)) cardToReplace = null

    const shadowLevel = Math.max(
      0,
      Math.min(4, Math.floor(Number(r.shadow_level ?? 0)))
    )

    const petalsDeficit: Record<string, number> = {}
    const deficitSrc = (r.petals_deficit as Record<string, unknown>) ?? {}
    for (const pn of PETAL_NAMES) {
      const v = Number(deficitSrc[pn] ?? 0)
      if (v > 0.02) petalsDeficit[pn] = Math.min(0.5, Math.max(0, v))
    }

    const proposeCloseActions = (Array.isArray(r.propose_close_actions)
      ? r.propose_close_actions
      : []
    )
      .filter((x): x is string => typeof x === 'string')
      .slice(0, 5)

    const cartes = (Array.isArray(r.cartes) ? r.cartes : Array.isArray(r.cards_to_reveal) ? r.cards_to_reveal : [])
      .filter((x): x is string => typeof x === 'string' && isValidCard(x))

    const combined = [phrase, question].filter(Boolean).join(' ').trim()
    const poetic = (dreamscapeConfig.force_question_finale && combined && !combined.trim().endsWith('?'))
      ? (combined.trimEnd() + ' ?')
      : combined

    return NextResponse.json({
      poetic_reflection: poetic,
      open_question: question || null,
      dreamscape_config: dreamscapeConfig,
      active_petals: activePetals,
      petals_deficit: petalsDeficit,
      cards_to_reveal: cartes,
      card_to_replace: cardToReplace,
      shadow_detected: shadowLevel >= 1,
      shadow_level: shadowLevel,
      shadow_urgent: shadowLevel >= 4,
      shadow_card: shadowCard,
      propose_close: !!r.propose_close,
      propose_close_actions: proposeCloseActions,
      provider: (await getLlmMetaForTask('analyze-mood')).provider,
      degraded: false,
    })
  }

  return NextResponse.json(
    mockResponse(
      result == null
        ? 'Réponse IA vide ou non JSON'
        : 'Réponse IA sans champ phrase'
    )
  )
}
