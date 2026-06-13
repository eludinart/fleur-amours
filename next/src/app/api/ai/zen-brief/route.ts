/**
 * POST /api/ai/zen-brief
 * Synthèse « En bref » pour Mon Jardin : profil, explorations, aspirations,
 * désirs, volonté et transformations — cache serveur (jardin-ai-token-cache).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { isDbConfigured } from '@/lib/db'
import { getUserTimeline, timelineSignature } from '@/lib/db-timeline'
import { syncUserTimeline } from '@/lib/db-timeline-sync'
import { my as tarotMy } from '@/lib/db-tarot'
import { listByEmailForTimeline } from '@/lib/db-sessions'
import { resolveUserPetalsProfile } from '@/lib/resolve-user-petals'
import { getCachedZenBrief, setCachedZenBrief, zenBriefSignature, normalizeZenBriefPayload, type ZenBriefPayload } from '@/lib/db-zen-brief'
import { openrouterCall } from '@/lib/openrouter'
import { getOpenRouterModel } from '@/lib/openrouter-config'
import { getLangInstruction } from '@/lib/prompts'
import { PETAL_ORDER_IDS } from '@/lib/petal-theme'
import {
  aggregateSessionDeficits,
  detectShadowZones,
  weakProfilePetals,
} from '@/lib/petal-shadow'

export const dynamic = 'force-dynamic'

const CACHE_VERSION = 'v5-shadow'

const PETAL_LABELS_FR: Record<string, string> = {
  agape: 'Agapè (don désintéressé)',
  philautia: 'Philautia (estime de soi)',
  mania: 'Mania (passion intense)',
  storge: 'Storgè (attachement, racines)',
  pragma: 'Pragma (amour construit)',
  philia: 'Philia (amitié, loyauté)',
  ludus: 'Ludus (jeu, légèreté)',
  eros: 'Éros (désir, élan vital)',
}

function resolveLocale(req: NextRequest, bodyLocale?: string): string {
  const header = req.headers.get('x-locale') || req.headers.get('X-Locale')
  return String(bodyLocale ?? header ?? 'fr').toLowerCase().slice(0, 5)
}

function petalProfileLine(petals: Record<string, number> | null): string {
  if (!petals) return ''
  const ordered = PETAL_ORDER_IDS.map((id) => ({ id, v: Number(petals[id] ?? 0) }))
    .filter((x) => x.v >= 0.05)
    .sort((a, b) => b.v - a.v)
  if (!ordered.length) return ''
  return ordered
    .slice(0, 4)
    .map((x) => `${PETAL_LABELS_FR[x.id] ?? x.id}`)
    .join(' · ')
}

function extractPlanSynthesis(s: Record<string, unknown>): string {
  const plan = (s.step_data as Record<string, unknown> | undefined)?.plan14j ?? s.plan14j
  const syn =
    (plan as Record<string, unknown> | null)?.synthesis ||
    (plan as Record<string, unknown> | null)?.synthesis_suggestion
  return typeof syn === 'string' ? syn.trim().slice(0, 280) : ''
}

function buildContext(params: {
  petals: Record<string, number> | null
  events: Awaited<ReturnType<typeof getUserTimeline>>
  readings: Record<string, unknown>[]
  sessions: Record<string, unknown>[]
  shadowZones: ReturnType<typeof detectShadowZones>
}): string {
  const lines: string[] = []

  const profile = petalProfileLine(params.petals)
  if (profile) lines.push(`PROFIL PÉTALES (dominants): ${profile}`)

  const deficits = aggregateSessionDeficits(params.sessions)
  const weak = params.petals ? weakProfilePetals(params.petals) : []
  if (params.shadowZones.length) {
    lines.push(
      `ZONES D'OMBRE (pétales en tension ou en retrait): ${params.shadowZones
        .map((z) => `${PETAL_LABELS_FR[z.petalId] ?? z.petalId} (${z.reason})`)
        .join(' · ')}`
    )
  } else if (weak.length) {
    lines.push(`PÉTALES PEU NOURRIS: ${weak.map((id) => PETAL_LABELS_FR[id] ?? id).join(' · ')}`)
  }
  const defLine = PETAL_ORDER_IDS.filter((id) => Number(deficits[id] ?? 0) >= 0.05)
  if (defLine.length) {
    lines.push(
      `DÉFICITS SESSIONS: ${defLine.map((id) => `${PETAL_LABELS_FR[id] ?? id} (${Number(deficits[id]).toFixed(2)})`).join(' · ')}`
    )
  }

  for (const e of params.events.slice(0, 25)) {
    const sum = e.summary?.trim()
    lines.push(
      `${e.createdAt} | ${e.source} | ${e.title}${sum ? ` — ${sum.slice(0, 220)}` : ''}`
    )
  }

  const intentions = params.readings
    .slice(0, 12)
    .map((r) => {
      const intent = String(r.intention ?? '').trim()
      const refl = String(r.reflection ?? '').trim()
      const type = String(r.type ?? 'simple')
      if (!intent && !refl) return ''
      const parts = [type === 'four' ? 'Tirage 4 portes' : 'Tirage']
      if (intent) parts.push(`intention: « ${intent.slice(0, 160)} »`)
      if (refl) parts.push(`réflexion: ${refl.slice(0, 140)}`)
      return parts.join(' — ')
    })
    .filter(Boolean)

  if (intentions.length) {
    lines.push('INTENTIONS & RÉFLEXIONS TIRAGES:')
    intentions.forEach((i) => lines.push(`- ${i}`))
  }

  const sessionLines = params.sessions
    .slice(0, 8)
    .map((s) => {
      const fw = String(s.first_words ?? '').trim()
      const door = String(s.door_suggested ?? '').trim()
      const plan = extractPlanSynthesis(s)
      const parts: string[] = []
      if (door) parts.push(`porte ${door}`)
      if (fw) parts.push(`mots d'entrée: « ${fw.slice(0, 120)} »`)
      if (plan) parts.push(`synthèse: ${plan.slice(0, 160)}`)
      return parts.length ? parts.join(' — ') : ''
    })
    .filter(Boolean)

  if (sessionLines.length) {
    lines.push('SESSIONS (aspirations exprimées):')
    sessionLines.forEach((s) => lines.push(`- ${s}`))
  }

  return lines.join('\n')
}

function fallbackBrief(locale: string, petals: Record<string, number> | null, eventCount: number): ZenBriefPayload {
  const en = locale.startsWith('en')
  const top = petals
    ? PETAL_ORDER_IDS.map((id) => ({ id, v: Number(petals[id] ?? 0) }))
        .sort((a, b) => b.v - a.v)[0]?.id
    : null
  const petalName = top ? PETAL_LABELS_FR[top]?.split(' ')[0] ?? top : null

  if (eventCount === 0) {
    return en
      ? {
          headline: 'Your inner garden is opening',
          profile:
            'Your emotional profile is still taking shape. The petals will reveal how you love, how you hold yourself, and what you are ready to welcome.',
          aspirations:
            'Each draw and exploration will clarify what you desire and what you aspire to build in your relationships and projects.',
          movement: 'Your will can begin with one sincere intention — the transformation will follow at its own pace.',
        }
      : {
          headline: 'Ton jardin intérieur s\'ouvre',
          profile:
            'Ton profil affectif se dessine encore. Les pétales diront comment tu aimes, comment tu te tiens, et ce que tu es prête à accueillir.',
          aspirations:
            'Chaque tirage et exploration précisera ce que tu désires et ce vers quoi tu aspires dans tes liens et tes projets.',
          movement: 'Ta volonté peut commencer par une intention sincère — la transformation suivra son rythme.',
        }
  }

  return en
    ? {
        headline: petalName ? `${petalName} colors your path` : 'Your path is alive',
        profile:
          'Your explorations sketch an emotional climate that is uniquely yours. Listen to which petals keep returning in your draws and sessions.',
        aspirations:
          'What you seek in your intentions and reflections points to desires that deserve to be named and honored.',
        movement: 'A transformation is already underway — notice what repeats, what loosens, and what your will is leaning toward.',
      }
    : {
        headline: petalName ? `${petalName} colore ton chemin` : 'Ton chemin est vivant',
        profile:
          'Tes explorations dessinent un climat affectif qui t\'appartient. Écoute quels pétales reviennent dans tes tirages et tes sessions.',
        aspirations:
          'Ce que tu cherches dans tes intentions et tes réflexions indique des désirs qui méritent d\'être nommés et honorés.',
        movement: 'Une transformation est déjà en cours — remarque ce qui revient, ce qui se dénoue, et où ta volonté s\'oriente.',
      }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const body = (await req.json().catch(() => ({}))) as { locale?: string }
    const locale = resolveLocale(req, body.locale)

    const user = await authMe(uid).catch(() => null)
    const email = user?.email ?? null

    const petals = await resolveUserPetalsProfile(uid, email)

    if (!isDbConfigured()) {
      return NextResponse.json({ brief: fallbackBrief(locale, petals, 0), cached: false })
    }

    await syncUserTimeline(uid, email)
    const events = await getUserTimeline(uid, 40)
    const timelineSig = `${timelineSignature(events)}:${CACHE_VERSION}`
    const signature = zenBriefSignature(timelineSig, petals)

    const cached = await getCachedZenBrief(uid, locale, signature)
    if (cached) {
      return NextResponse.json({ brief: cached, cached: true })
    }

    if (events.length === 0 && !petals) {
      const brief = fallbackBrief(locale, petals, 0)
      return NextResponse.json({ brief, cached: false })
    }

    const [{ items: readings }, { items: sessions }] = await Promise.all([
      tarotMy(String(uid), email),
      email ? listByEmailForTimeline(email, 12) : Promise.resolve({ items: [] as Record<string, unknown>[] }),
    ])

    const context = buildContext({
      petals,
      events,
      readings: readings as Record<string, unknown>[],
      sessions: sessions as Record<string, unknown>[],
      shadowZones: detectShadowZones({
        petals: petals ?? {},
        deficits: aggregateSessionDeficits(sessions as Record<string, unknown>[]),
      }),
    })

    const system =
      'Tu rédiges le bloc « En bref » de Mon Jardin (Fleur d\'AmOurs) pour UNE personne réelle.\n' +
      'À partir des données (profil pétales, zones d\'ombre, chronologie, intentions, sessions), écris un texte VIVANT qui lui parle directement (tutoiement en français).\n\n' +
      'Réponds UNIQUEMENT en JSON avec 4 champs DISTINCTS — chaque champ = 2 ou 3 phrases COMPLÈTES (phrase entière terminée par . ! ou ?), jamais coupées :\n' +
      '- headline : accroche personnelle (1 phrase, max 140 caractères)\n' +
      '- profile : son profil affectif actuel, langage des pétales, jamais de pourcentages (max 480 caractères)\n' +
      '- aspirations : ce que ses explorations révèlent de ses aspirations, désirs et envies profondes (max 480 caractères)\n' +
      '- movement : sa volonté, sa direction, les transformations amorcées ; nomme aussi les zones d\'ombre du moment si présentes, avec douceur (max 400 caractères)\n\n' +
      'Interdits : compteur d\'activités, jargon clinique, haïku, généralités vides, phrase inachevée.\n' +
      getLangInstruction(locale)

    const result = await openrouterCall(
      system,
      [{ role: 'user', content: context || 'Peu de données — inviter à explorer avec bienveillance.' }],
      { responseFormatJson: true, maxTokens: 1200 }
    )

    let brief: ZenBriefPayload
    if (result && typeof result === 'object') {
      const r = result as Record<string, unknown>
      const fb = fallbackBrief(locale, petals, events.length)
      brief = normalizeZenBriefPayload({
        headline: String(r.headline ?? '').trim() || fb.headline,
        profile: String(r.profile ?? r.portrait ?? '').trim() || fb.profile,
        aspirations: String(r.aspirations ?? '').trim() || fb.aspirations,
        movement: String(r.movement ?? r.focus ?? '').trim() || fb.movement,
      })
      await setCachedZenBrief(uid, locale, signature, brief, getOpenRouterModel()).catch(() => {})
      return NextResponse.json({ brief, cached: false })
    }

    brief = fallbackBrief(locale, petals, events.length)
    return NextResponse.json({ brief, cached: false })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message || 'Erreur' }, { status: e.status || 401 })
  }
}
