/**
 * POST /api/ai/checkin-echo
 * Rituel « Écho du jour » — intention → réponse poétique + pétale mis en valeur.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { hasCheckinToday } from '@/lib/db-checkins'
import { isLlmConfigured, getLlmMetaForTask } from '@/lib/llm'
import { AiAccessDeniedError, aiAccessErrorResponse, guardedLlmCall } from '@/lib/ai-guard'
import { getLangInstruction } from '@/lib/prompts'
import {
  buildCheckinContext,
  fallbackCheckinEcho,
  normalizeCheckinEcho,
  petalLabel,
} from '@/lib/checkin-echo'
import { topPetalIds } from '@/lib/petal-tarot'
import { PETAL_ORDER_IDS } from '@/lib/petal-theme'
import { detectShadowZones, weakProfilePetals } from '@/lib/petal-shadow'

export const dynamic = 'force-dynamic'

function resolveLocale(req: NextRequest, bodyLocale?: string): string {
  const header = req.headers.get('x-locale') || req.headers.get('X-Locale')
  return String(bodyLocale ?? header ?? 'fr').toLowerCase().slice(0, 5)
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

  let body: { intention?: string; locale?: string }
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const intention = String(body.intention ?? '').trim()
  const locale = resolveLocale(req, body.locale)

  if (!intention) {
    return NextResponse.json({ error: 'Intention requise' }, { status: 400 })
  }

  if (await hasCheckinToday(uid)) {
    return NextResponse.json(
      { error: 'Un seul écho par jour est possible.', code: 'CHECKIN_DAILY_LIMIT' },
      { status: 409 }
    )
  }

  const user = await authMe(uid).catch(() => null)
  const email = user?.email ?? null
  const ctx = await buildCheckinContext(uid, email, locale)
  const dom = topPetalIds(ctx.petals, 1, 0.04)[0] ?? null

  if (!(await isLlmConfigured())) {
    const echo = fallbackCheckinEcho(intention, locale, dom)
    return NextResponse.json({ ...echo, cached: false, provider: 'fallback' })
  }

  const weak = weakProfilePetals(ctx.petals)
  const shadow = detectShadowZones({ petals: ctx.petals, deficits: {} })
  const profileLine = PETAL_ORDER_IDS.map((id) => `${petalLabel(id, locale)}:${Number(ctx.petals[id] ?? 0).toFixed(2)}`)
    .filter((_, i) => Number(ctx.petals[PETAL_ORDER_IDS[i]] ?? 0) >= 0.05)
    .join(' · ')

  const lastLine = ctx.lastEcho?.whisper
    ? `DERNIER ÉCHO: « ${ctx.lastEcho.whisper} » (pétale ${ctx.lastEcho.highlightPetal ?? '—'})`
    : ''

  const system =
    "Tu es une voix d'accompagnement pour le rituel « Écho du jour » de Fleur d'AmOurs.\n" +
    "L'utilisateur pose une intention ou une question du jour. Tu réponds avec douceur, en tutoyant en français.\n" +
    "Tu ne diagnostiques pas, tu ne moralises pas. Tu miroirs, tu symbolises via UN pétale (dimension d'amour grec), tu ouvres.\n\n" +
    'Réponds UNIQUEMENT en JSON valide :\n' +
    '{\n' +
    '  "echo": "2 à 3 phrases complètes, poétiques mais ancrées dans l\'intention — le cœur de la réponse",\n' +
    '  "highlight_petal": "un parmi agape|philautia|mania|storge|pragma|philia|ludus|eros",\n' +
    '  "invitation": "une question ouverte, non directive, pour la suite de la journée",\n' +
    '  "whisper": "une ligne courte (max 120 car.) pour l\'historique — peut reprendre l\'essence de l\'écho"\n' +
    '}\n' +
    getLangInstruction(locale)

  const userContent = [
    `INTENTION DU JOUR: « ${intention.slice(0, 480)} »`,
    profileLine ? `PROFIL PÉTALES: ${profileLine}` : 'PROFIL PÉTALES: encore peu exploré',
    weak.length ? `PÉTALES PEU NOURRIS: ${weak.map((id) => petalLabel(id, locale)).join(', ')}` : '',
    shadow.length
      ? `ZONES DE TENSION: ${shadow.map((z) => petalLabel(z.petalId, locale)).join(', ')}`
      : '',
    lastLine,
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const guarded = await guardedLlmCall({
      taskId: 'checkin-echo',
      userId: uid,
      system,
      messages: [{ role: 'user', content: userContent }],
      options: { maxTokens: 450, responseFormatJson: true },
    })

    const normalized = normalizeCheckinEcho(guarded.result, locale)
    if (normalized) {
      const { provider } = await getLlmMetaForTask('checkin-echo')
      return NextResponse.json({ ...normalized, cached: false, provider })
    }
  } catch (e: unknown) {
    if (e instanceof AiAccessDeniedError) return aiAccessErrorResponse(e.result)
  }

  const echo = fallbackCheckinEcho(intention, locale, dom)
  return NextResponse.json({ ...echo, cached: false, provider: 'fallback' })
}
