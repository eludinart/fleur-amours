/**
 * POST /api/ai/plan14j
 * Génère un plan personnalisé 14 jours + synthèse + 3 micro-leviers
 * à partir des pétales, ancres, cartes et échanges de la session.
 * Cache : si session_id fourni, lit plan14j_json en DB avant d'appeler le LLM.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { openrouterCall } from '@/lib/openrouter'
import { getLangInstruction } from '@/lib/prompts'
import { getById, update } from '@/lib/db-sessions'
import { isDbConfigured } from '@/lib/db'
import { appendManuelReferenceToSystem } from '@/lib/manuel-ai-corpus'

export const dynamic = 'force-dynamic'

function getLocale(req: NextRequest): string {
  return req.headers.get('x-locale') || 'fr'
}

const PLAN14J_SYSTEM = `Tu es le Tuteur maïeutique du Jardin Fleur d'AmOurs. À partir des données de la session (pétales, ancres de porte, cartes tirées, notes d'échange), tu génères un plan d'intégration personnalisé.

═══ TON RÔLE ═══
- Phrase de synthèse : une phrase poétique et personnalisée qui capture l'essence du parcours (1-2 phrases).
- 3 micro-leviers : actions concrètes, reliées aux habitudes/synthèses des ancres. Format : "action concrète et courte" ou "action||ANCHOR||nom de l'habitude" si lié à une ancre.
- Plan 14 jours : pour chaque jour (J1 à J14), un thème distinct et une action concrète, en progression. Varie les thèmes (ancrage, respiration, gratitude, lien, créativité, mouvement, silence, etc.) et les actions selon le profil.

═══ RÈGLES ═══
- Personnalise TOUT selon les pétales dominants, les cartes tirées, les ancres et les mots de la personne.
- Chaque jour du plan DOIT être différent (pas de répétition "Ancrage - Respirer et observer").
- Les micro-leviers doivent être actionnables au quotidien.
- Réponds en JSON strict, sans texte avant ou après.`

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e?.message }, { status: e?.status || 401 })
  }

  if (!process.env.OPENROUTER_API_KEY) {
    const fallbackThemes = [
      { theme: 'Ancrage', action: 'Respirer et observer.' },
      { theme: 'Présence', action: 'Prendre 3 souffles conscients.' },
      { theme: 'Gratitude', action: 'Noter une chose pour laquelle tu es reconnaissant·e.' },
      { theme: 'Corps', action: 'Bouger 5 minutes (marche, étirements).' },
      { theme: 'Créativité', action: 'Faire un geste gratuit pour quelqu\'un.' },
      { theme: 'Silence', action: '5 minutes sans écran.' },
      { theme: 'Lien', action: 'Envisager un contact qui fait du bien.' },
      { theme: 'Mouvement', action: 'Changer de posture ou de lieu.' },
      { theme: 'Accueil', action: 'Accueillir une émotion sans jugement.' },
      { theme: 'Intention', action: 'Choisir une intention pour la journée.' },
      { theme: 'Récupération', action: 'Pause délibérée de 10 minutes.' },
      { theme: 'Expression', action: 'Écrire ou dire ce qui est vivant.' },
      { theme: 'Nourriture', action: 'Un repas en pleine conscience.' },
      { theme: 'Intégration', action: 'Revisiter ce parcours et noter ce qui résonne.' },
    ]
    return NextResponse.json({
      synthesis: "Votre parcours à travers les quatre portes du Jardin nourrit ce plan — personnalisez-le selon ce qui résonne en vous.",
      levers: [],
      plan_14j: fallbackThemes.map((t, i) => ({ day: i + 1, ...t, context: '' })),
    })
  }

  let body: {
    petals?: Record<string, number>
    cards_drawn?: string[]
    session_notes?: string
    anchors?: Array<{ door?: string; subtitle?: string; synthesis?: string; habit?: string }>
    user_email?: string
    session_id?: number
    force?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({
      synthesis: '',
      levers: [],
      plan_14j: [],
    })
  }

  const sessionId = body.session_id ? parseInt(String(body.session_id), 10) : null
  if (sessionId && isDbConfigured() && !body.force) {
    try {
      const session = await getById(sessionId)
      if (session?.plan14j && typeof session.plan14j === 'object') {
        const p = session.plan14j as Record<string, unknown>
        if (p.synthesis && Array.isArray(p.plan_14j) && (p.plan_14j as unknown[]).length > 0) {
          return NextResponse.json({ ...p, cached: true })
        }
      }
    } catch {
      // cache miss → génération normale
    }
  }

  const petals = body.petals && typeof body.petals === 'object' ? body.petals : {}
  const cardsDrawn = Array.isArray(body.cards_drawn) ? body.cards_drawn : []
  const notes = typeof body.session_notes === 'string' ? body.session_notes.trim() : ''
  const anchors = Array.isArray(body.anchors) ? body.anchors : []
  const locale = getLocale(req)

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

  const ctx: string[] = []
  if (Object.keys(petals).length > 0) {
    const pLines = Object.entries(petals)
      .filter(([, v]) => !isNaN(Number(v)) && Number(v) > 0.05)
      .map(([k, v]) => `${labels[k] ?? k}: ${Math.round(Number(v) * 100)}%`)
    if (pLines.length > 0) ctx.push('Fleur (pétales dominants): ' + pLines.join(', '))
  }
  if (cardsDrawn.length > 0) ctx.push('Cartes tirées: ' + cardsDrawn.join(', '))
  if (anchors.length > 0) {
    const aLines = anchors.map(
      (a) => `- ${a.subtitle ?? a.door ?? 'Porte'}: synthèse "${a.synthesis ?? ''}" | habitude: ${a.habit ?? '—'}`
    )
    ctx.push('Ancres de session:\n' + aLines.join('\n'))
  }
  if (notes) ctx.push('Notes d\'échange (extraits):\n' + notes.slice(0, 2000))

  const userContent =
    (ctx.length > 0 ? 'Contexte de la session:\n' + ctx.join('\n\n') + '\n\n' : '') +
    'Génère le plan personnalisé en JSON strict avec les clés: synthesis (string), levers (array de 3 strings), plan_14j (array de 14 objets {day, theme, action, context}).' +
    getLangInstruction(locale)

  const planSystem = appendManuelReferenceToSystem(PLAN14J_SYSTEM, {
    retrievalQuery: [notes, cardsDrawn.join(' ')].filter(Boolean).join('\n').slice(0, 4_000),
    maxChars: 14_000,
    locale,
  })

  const result = await openrouterCall(planSystem, [{ role: 'user', content: userContent }], {
    maxTokens: 2400,
    responseFormatJson: true,
  })

  if (!result || typeof result !== 'object') {
    return NextResponse.json({
      synthesis: "Votre parcours à travers les quatre portes du Jardin nourrit ce plan — personnalisez-le selon ce qui résonne en vous.",
      levers: [],
      plan_14j: Array.from({ length: 14 }, (_, i) => ({
        day: i + 1,
        theme: '',
        action: '',
        context: '',
      })),
    })
  }

  const synthesis =
    typeof result.synthesis === 'string' && result.synthesis.trim()
      ? result.synthesis.trim()
      : "Votre parcours à travers les quatre portes du Jardin nourrit ce plan — personnalisez-le selon ce qui résonne en vous."

  const leversRaw = result.levers
  const levers = Array.isArray(leversRaw)
    ? leversRaw
        .filter((l): l is string => typeof l === 'string' && l.trim().length > 0)
        .slice(0, 3)
        .map((l) => l.trim())
    : []

  const plan14jRaw = result.plan_14j ?? result.plan_14j
  let plan14j = Array.isArray(plan14jRaw) ? plan14jRaw : []
  if (plan14j.length < 14) {
    const existing = plan14j as Array<{ day?: number; theme?: string; action?: string; context?: string }>
    plan14j = Array.from({ length: 14 }, (_, i) => {
      const d = existing[i]
      return {
        day: i + 1,
        theme: d?.theme ?? '',
        action: d?.action ?? '',
        context: d?.context ?? '',
      }
    })
  }

  const payload = {
    synthesis,
    synthesis_suggestion: result.synthesis_suggestion ?? null,
    levers,
    plan_14j: plan14j.slice(0, 14),
  }

  if (sessionId && isDbConfigured()) {
    try {
      await update({ id: sessionId, plan14j: payload })
    } catch {
      // non-bloquant
    }
  }

  return NextResponse.json(payload)
}
