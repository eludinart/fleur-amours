/**
 * POST /api/ai/analyze_mood
 * Analyse maïeutique du message utilisateur (Dreamscape).
 * Prompts et logique IA.
 */
import { NextRequest, NextResponse } from 'next/server'
import { openrouterCall } from '@/lib/openrouter'
import { getAnalyzeMoodPrompt } from '@/lib/prompts-resolver'
import { getLangInstruction, isValidPetal, isValidCard } from '@/lib/prompts'

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

const MOCK_RESPONSE = {
  poetic_reflection: 'Quel est ton climat intérieur en ce moment ?',
  active_petals: {},
  petals_deficit: {},
  shadow_detected: false,
  shadow_level: 0,
  shadow_urgent: false,
  shadow_card: null,
  cards_to_reveal: [],
  card_to_replace: null,
  propose_close: false,
  propose_close_actions: [] as string[],
  provider: 'node-mock',
}

export async function POST(req: NextRequest) {
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json(MOCK_RESPONSE)
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
    return NextResponse.json(MOCK_RESPONSE)
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
      "\n[Nouvelle promenade — choisis des cartes variées, évite La Tige et Le Bouton si tu les as déjà souvent proposées.]"
  }
  if (Object.keys(cardPositions).length > 0) {
    const lines = Object.entries(cardPositions).map(
      ([pos, carte]) => `${pos}:${carte}`
    )
    userMsg += `\n[Fleur actuelle — ${lines.join(', ')}]`
    if (allRevealed) {
      userMsg +=
        "\n[Toutes les cartes sont à l'endroit — tu peux proposer 1 remplacement pertinent si la dynamique de l'échange l'appelle.]"
      if (userTurns >= 12) {
        userMsg +=
          "\n[Promenade déjà longue — si une trajectoire ou des intentions ont émergé, propose de clôturer (propose_close : true) avec 1 à 3 actions concrètes.]"
      }
    }
  }
  userMsg += getLangInstruction(locale)
  messages.push({ role: 'user', content: userMsg })

  const systemPrompt = await getAnalyzeMoodPrompt()
  const result = await openrouterCall(
    systemPrompt,
    messages.map((m) => ({ role: m.role, content: m.content })),
    { maxTokens: 300 }
  )

  if (
    result &&
    typeof result === 'object' &&
    !Array.isArray(result) &&
    result.phrase
  ) {
    const r = result as Record<string, unknown>
    const phrase = String(r.phrase ?? '').trim()

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

    for (const p of petalsArr) {
      const key = tr(String(p))
      if (PETAL_NAMES.includes(key)) activePetals[key] = 0.8
    }

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

    const cartes = (Array.isArray(r.cartes) ? r.cartes : [])
      .filter((x): x is string => typeof x === 'string')

    return NextResponse.json({
      poetic_reflection: phrase,
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
      provider: 'openrouter',
    })
  }

  return NextResponse.json(MOCK_RESPONSE)
}
