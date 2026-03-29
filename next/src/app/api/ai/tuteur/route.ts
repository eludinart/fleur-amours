/**
 * POST /api/ai/tuteur
 * Dialogue maïeutique avec le Tuteur (Session 4 portes).
 * Utilise getTuteurPrompt() : DB > overrides > constante.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import {
  getSapBalance,
  transactionalSapUpdate,
  sapUsageReasonExists,
  TUTEUR_SAP_COST,
  SapError,
} from '@/lib/db-sap'
import { openrouterCall } from '@/lib/openrouter'
import { getTuteurPrompt } from '@/lib/prompts-resolver'
import { getLangInstruction } from '@/lib/prompts'
import { getCardInfo } from '@/lib/card-info'
import { isValidCard } from '@/lib/prompts'

export const dynamic = 'force-dynamic'

const PETAL_ORDER = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'] as const
const PETALS_SHADOW_MAP: Record<string, string[]> = {
  agape: ['dissolution', "sacrifice excessif", "perte de soi dans l'autre"],
  philautia: ['narcissisme', 'isolement', "manque d'estime de soi"],
  mania: ['possession', 'jalousie', 'obsession', 'dépendance affective'],
  storge: ['possessivité', 'repli', 'étouffement affectif'],
  pragma: ['routine', 'froid affectif', 'désengagement progressif'],
  philia: ['distance', 'déception', 'perte de lien profond'],
  ludus: ['superficialité', "évitement de l'engagement", 'fuite'],
  eros: ['consommation', 'dépendance physique', 'désir sans présence'],
}

function enforceCurrentDoorCard(
  suggestCard: unknown,
  currentDoor: string
): { name: string; door: string } | null {
  if (!suggestCard || typeof suggestCard !== 'object') return null
  const o = suggestCard as Record<string, unknown>
  const name = String(o.name ?? '').trim()
  if (!name || !isValidCard(name)) return null
  return { name, door: currentDoor || 'love' }
}

export async function POST(req: NextRequest) {
  let userId = ''
  try {
    ;({ userId } = await requireAuth(req))
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
  const uid = parseInt(userId, 10)
  const billTuteurSap = isDbConfigured() && !!process.env.OPENROUTER_API_KEY

  let body: {
    transcript?: string
    history?: Array<{ role?: string; content?: string }>
    current_petals?: Record<string, number>
    turn?: number
    card_name?: string
    card_group?: string
    locked_doors?: string[]
    overridden_petals?: Record<string, number>
    idempotency_key?: string
  }
  try {
    body = await req.json().catch(() => ({}))
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 422 })
  }

  const transcript = String(body.transcript ?? '').trim()
  if (!transcript) {
    return NextResponse.json({ error: 'Le transcript ne peut pas être vide.' }, { status: 422 })
  }

  const history = Array.isArray(body.history) ? body.history : []
  const currentPetals = (body.current_petals && typeof body.current_petals === 'object')
    ? body.current_petals
    : {}
  const turn = Math.max(0, Number(body.turn ?? 0))
  const cardName = String(body.card_name ?? '').trim()
  const cardGroup = String(body.card_group ?? '').trim() || 'love'
  const lockedDoors = Array.isArray(body.locked_doors) ? body.locked_doors : []
  const overriddenPetals = (body.overridden_petals && typeof body.overridden_petals === 'object')
    ? body.overridden_petals
    : {}
  const idempotencyKey = String(body.idempotency_key ?? '').trim().slice(0, 64) || null
  const sapReason = idempotencyKey ? `tuteur_turn:${idempotencyKey}` : 'tuteur_turn'

  const locale = req.headers.get('x-locale') || 'fr'

  let userContent =
    `Carte tirée : ${cardName || 'Porte : ' + cardGroup} (porte : ${cardGroup})\nTour : ${turn + 1}\n` +
    `Scores pétales (lumière) : ${JSON.stringify(currentPetals)}`

  const petalsShadowCtxLines: string[] = []
  for (const [pid, shadows] of Object.entries(PETALS_SHADOW_MAP)) {
    const score = Number(currentPetals[pid] ?? 0)
    const label = pid.charAt(0).toUpperCase() + pid.slice(1)
    const isExcess = ['mania', 'eros'].includes(pid) && score > 0.55
    const isDeficit =
      ['philautia', 'pragma', 'philia', 'storge'].includes(pid) && score < 0.15 && score >= 0
    if (isExcess || isDeficit) {
      const type = isExcess ? 'excès possible' : 'déficit possible'
      petalsShadowCtxLines.push(`- ${label} (${type}) → ombres associées : ${shadows.join(', ')}`)
    }
  }
  if (petalsShadowCtxLines.length > 0) {
    userContent +=
      "\n\n⚠ SIGNAUX D'OMBRE DÉTECTÉS SUR LES PÉTALES :\n" +
      petalsShadowCtxLines.join('\n') +
      '\nSi la parole de la personne confirme ces tensions, mets shadow_detected:true et nomme l\'ombre dans reflection.'
  }
  if (Object.keys(overriddenPetals).length > 0) {
    userContent += `\nPétales modifiés par l'utilisateur (prioritaires) : ${JSON.stringify(overriddenPetals)}`
  }
  if (lockedDoors.length > 0) {
    userContent += `\nPortes déjà verrouillées : ${lockedDoors.join(', ')}`
  }
  userContent += `\n\nParole de la personne : ${transcript}`
  userContent += getLangInstruction(locale)

  const cardInfo = await getCardInfo(cardName)
  if (cardInfo && (cardInfo.theme || cardInfo.questionRacine)) {
    userContent =
      `═══ THÉMATIQUE CARTE (Tarot Fleur d'Amours) ═══\n` +
      `Cette carte invite à explorer : ${cardInfo.theme}\n` +
      `Question racine : « ${cardInfo.questionRacine} »\n` +
      `Formule ta question en t'inspirant de cette thématique.\n═══\n\n` +
      userContent
  }

  // Limite l'historique aux 8 derniers tours pour réduire les tokens d'input.
  const MAX_HISTORY_TURNS = 8
  const trimmedHistory = history.slice(-MAX_HISTORY_TURNS * 2)

  const oaiMessages: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (const m of trimmedHistory) {
    const role = (m.role ?? 'user') as 'user' | 'assistant'
    const content = String(m.content ?? '').trim()
    if (role && content) oaiMessages.push({ role, content })
  }
  oaiMessages.push({ role: 'user', content: userContent })

  const systemPrompt = await getTuteurPrompt()

  if (billTuteurSap && uid > 0) {
    const bal = await getSapBalance(uid)
    if (bal < TUTEUR_SAP_COST) {
      return NextResponse.json(
        {
          success: false,
          error: `Solde SAP insuffisant (requis ${TUTEUR_SAP_COST} pour un échange avec le Tuteur).`,
        },
        { status: 402 }
      )
    }
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({
      response_a: 'Je vous reçois.',
      response_b: '',
      reflection: null,
      question: "Qu'est-ce qui est le plus vivant dans ce que vous venez de dire ?",
      petals: Object.fromEntries(PETAL_ORDER.map((p) => [p, currentPetals[p] ?? 0])),
      petals_deficit: {},
      shadow_level: 0,
      shadow_detected: false,
      shadow_urgent: false,
      resource_card: null,
      turn_complete: false,
      next_door_suggestion: null,
      door_summary_preview: null,
      explore_petal: null,
      suggest_card: null,
      provider: 'node-no-key',
    })
  }

  const result = await openrouterCall(systemPrompt, oaiMessages, { maxTokens: 1200 })
  const question = (result && typeof result === 'object' && (result.question ?? result.first_question)) as string | undefined

  if (result && question && typeof question === 'string') {
    const r = result as Record<string, unknown>
    const resultPetals = (r.petals && typeof r.petals === 'object') ? r.petals as Record<string, unknown> : {}
    const petals: Record<string, number> = {}
    for (const p of PETAL_ORDER) {
      petals[p] = Math.max(0, Math.min(1, Number(resultPetals[p] ?? currentPetals[p] ?? 0)))
    }
    for (const [p, v] of Object.entries(overriddenPetals)) {
      if (PETAL_ORDER.includes(p as (typeof PETAL_ORDER)[number])) {
        petals[p] = Math.max(0, Math.min(1, Number(v)))
      }
    }
    let resourceCard: string | null = String((result as Record<string, unknown>).resource_card ?? '').trim() || null
    if (resourceCard && !isValidCard(resourceCard)) resourceCard = null
    const doorPreview = (result as Record<string, unknown>).door_summary_preview
    const validDoorPreview =
      doorPreview &&
      typeof doorPreview === 'object' &&
      ('synthesis_suggestion' in doorPreview || 'paths_solutions' in doorPreview)
        ? {
            synthesis_suggestion: String((doorPreview as Record<string, unknown>).synthesis_suggestion ?? ''),
            paths_solutions: String((doorPreview as Record<string, unknown>).paths_solutions ?? ''),
            intention_emerged: String((doorPreview as Record<string, unknown>).intention_emerged ?? ''),
            choices_emerged: String((doorPreview as Record<string, unknown>).choices_emerged ?? ''),
          }
        : null

    if (billTuteurSap && uid > 0) {
      // Idempotence : si la clé de tour est connue, on ne débite qu'une seule fois
      // même en cas de retry réseau côté client.
      const alreadyDebited = idempotencyKey
        ? await sapUsageReasonExists(sapReason).catch(() => false)
        : false

      if (!alreadyDebited) {
        let debitOk = false
        let lastDebitErr: unknown = null
        for (let attempt = 0; attempt < 2 && !debitOk; attempt++) {
          try {
            if (attempt > 0) await new Promise((r) => setTimeout(r, 80))
            await transactionalSapUpdate(uid, TUTEUR_SAP_COST, sapReason, 'usage')
            debitOk = true
          } catch (e) {
            lastDebitErr = e
            if (e instanceof SapError && e.code === 'INSUFFICIENT') {
              return NextResponse.json(
                { success: false, error: 'Solde SAP insuffisant.' },
                { status: 402 }
              )
            }
          }
        }
        if (!debitOk) {
          console.error('[sap] tuteur debit failed after retry', lastDebitErr)
          return NextResponse.json(
            { success: false, error: "Impossible d'enregistrer la consommation SAP." },
            { status: 500 }
          )
        }
      }
    }

    return NextResponse.json({
      response_a: (result as Record<string, unknown>).response_a ?? 'Je vous reçois.',
      response_b: (result as Record<string, unknown>).response_b ?? '',
      reflection: (result as Record<string, unknown>).reflection ?? null,
      question,
      petals,
      petals_deficit: (result as Record<string, unknown>).petals_deficit ?? {},
      shadow_level: Math.max(0, Math.min(4, Number((result as Record<string, unknown>).shadow_level ?? 0))),
      shadow_detected: Boolean((result as Record<string, unknown>).shadow_detected ?? false),
      shadow_urgent: Boolean((result as Record<string, unknown>).shadow_urgent ?? false),
      resource_card: resourceCard,
      turn_complete: Boolean((result as Record<string, unknown>).turn_complete ?? false),
      next_door_suggestion: (result as Record<string, unknown>).next_door_suggestion ?? null,
      door_summary_preview: validDoorPreview,
      explore_petal: (result as Record<string, unknown>).explore_petal ?? null,
      suggest_card: enforceCurrentDoorCard(
        (result as Record<string, unknown>).suggest_card,
        cardGroup
      ),
      provider: 'openrouter',
    })
  }

  return NextResponse.json({
    response_a: 'Je vous reçois.',
    response_b: '',
    reflection: null,
    question: "Qu'est-ce qui est le plus vivant dans ce que vous venez de dire ?",
    petals: Object.fromEntries(PETAL_ORDER.map((p) => [p, currentPetals[p] ?? 0])),
    petals_deficit: {},
    shadow_level: 0,
    shadow_detected: false,
    shadow_urgent: false,
    resource_card: null,
    turn_complete: false,
    next_door_suggestion: null,
    door_summary_preview: null,
    explore_petal: null,
    suggest_card: null,
    provider: 'node-fallback',
  })
}
