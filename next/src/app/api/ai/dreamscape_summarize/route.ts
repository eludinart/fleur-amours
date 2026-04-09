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

const DREAMSCAPE_SUMMARIZE_SYSTEM = `Tu es le Tuteur maïeutique du jardin intérieur.

Ta tâche: produire une synthèse très utile et explicite de la promenade onirique.

Tu DOIS répondre en JSON STRICT (sans markdown, sans texte autour).

Schéma JSON attendu :
{
  "intention_depart": "<2-4 lignes : ce que la personne cherchait, la question implicite>",
  "ce_qui_a_emerge": "<12-20 lignes : ce qui a bougé, tensions/lumières, avant→après, décisions qui se dessinent>",
  "trajectoire_cartes": "<8-14 lignes : la trajectoire (ordre), et 1-2 phrases de sens vécu par carte/position si présentes>",
  "citations": ["<2 à 4 citations courtes de l'utilisateur, entre guillemets, max 140 caractères chacune>"],
  "actions_a_oeuvrer": ["<3 à 7 actions concrètes, courtes, non-prescriptives, qui reprennent les mots de la personne>"]
}

Contraintes impératives :
- Aucune morale, aucun conseil direct.
- Être spécifique : évite les généralités. Donne des détails concrets.
- Tu dois écrire des sections SUBSTANTIELLES :
  - intention_depart: minimum 240 caractères
  - ce_qui_a_emerge: minimum 900 caractères
  - trajectoire_cartes: minimum 600 caractères (si des cartes/positions existent), sinon explique clairement pourquoi cette section est plus courte
  - actions_a_oeuvrer: 3 à 7 puces
- Si aucune action n'est donnée dans le contexte, propose 3 à 5 actions très prudentes, formulées comme un engagement libre (ex: "Je peux…").
- Les citations doivent venir de l'utilisateur (pas de l'IA), et être reconnaissables.
`

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
    { maxTokens: 1800, responseFormatJson: true }
  )

  const r = (result && typeof result === 'object' && !Array.isArray(result)) ? (result as Record<string, unknown>) : null
  const intention = String(r?.intention_depart ?? '').trim()
  const emerge = String(r?.ce_qui_a_emerge ?? '').trim()
  const traj = String(r?.trajectoire_cartes ?? '').trim()
  const citations = (Array.isArray(r?.citations) ? r?.citations : [])
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .slice(0, 4)
  const actionsOut = (Array.isArray(r?.actions_a_oeuvrer) ? r?.actions_a_oeuvrer : [])
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .slice(0, 4)

  const fallback = 'Cette promenade onirique a nourri le jardin intérieur.'
  const summaryText = [intention && `Intention de départ\n${intention}`,
    emerge && `Ce qui a émergé\n${emerge}`,
    traj && `Trajectoire & cartes\n${traj}`,
    citations.length ? `Citations\n- ${citations.join('\n- ')}` : '',
    actionsOut.length ? `Actions à œuvrer\n- ${actionsOut.join('\n- ')}` : '',
  ].filter(Boolean).join('\n\n') || fallback

  return NextResponse.json({
    summary: summaryText,
    sections: {
      intention_depart: intention || null,
      ce_qui_a_emerge: emerge || null,
      trajectoire_cartes: traj || null,
      citations,
      actions_a_oeuvrer: actionsOut,
    },
  })
}
