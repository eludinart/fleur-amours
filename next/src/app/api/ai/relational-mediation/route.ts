/**
 * POST /api/ai/relational-mediation
 * Médiation relationnelle : reformulation neutre, désescalade, et "ce que l'autre
 * a voulu dire". Garde-fous : ne prend pas parti, ne diagnostique pas, propose des
 * formulations non-violentes. La sortie est journalisée dans le fil de la dyade
 * (cache : réutilisable à l'affichage, pas de re-génération pour le même message).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { addDyadEvent, getMyDyad, userInDyad } from '@/lib/db-dyads'
import { openrouterCall } from '@/lib/openrouter'

export const dynamic = 'force-dynamic'

type Mediation = {
  reframed: string
  otherPerspective: string
  deescalation: string
  suggestion: string
}

function systemPrompt(locale: string): string {
  if (locale.startsWith('en')) {
    return 'You are a neutral relationship mediator. You NEVER take sides, NEVER diagnose, NEVER assign blame. Given a message someone wants to send their partner, return JSON with keys: reframed (a non-violent, I-statement reformulation), otherPerspective (a charitable reading of what the other may feel/mean), deescalation (one calming reframe), suggestion (one concrete, gentle next step). Each field under 280 chars.'
  }
  if (locale.startsWith('es')) {
    return 'Eres un mediador relacional neutral. NUNCA tomas partido, NUNCA diagnosticas, NUNCA culpas. A partir de un mensaje que alguien quiere enviar a su pareja, devuelve JSON con claves: reframed (reformulación no violenta en primera persona), otherPerspective (lectura compasiva de lo que el otro podría sentir/querer decir), deescalation (un reencuadre calmante), suggestion (un próximo paso concreto y suave). Cada campo < 280 caracteres.'
  }
  return 'Tu es un médiateur relationnel neutre. Tu ne prends JAMAIS parti, ne poses JAMAIS de diagnostic, n\'attribues JAMAIS de faute. À partir d\'un message qu\'une personne veut envoyer à son/sa partenaire, renvoie un JSON avec les clés : reframed (reformulation non-violente en "je"), otherPerspective (lecture bienveillante de ce que l\'autre pourrait ressentir/vouloir dire), deescalation (un recadrage apaisant), suggestion (un prochain pas concret et doux). Chaque champ < 280 caractères.'
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const body = (await req.json().catch(() => ({}))) as { message?: string; locale?: string }
    const message = String(body.message ?? '').trim()
    const locale = String(body.locale ?? 'fr').toLowerCase().slice(0, 5)
    if (!message) return NextResponse.json({ error: 'Message requis' }, { status: 400 })

    const dyad = await getMyDyad(uid)
    if (!dyad || dyad.status !== 'active' || !userInDyad(dyad, uid)) {
      return NextResponse.json({ error: 'Aucune dyade active' }, { status: 404 })
    }

    const result = await openrouterCall(
      systemPrompt(locale),
      [{ role: 'user', content: message.slice(0, 2000) }],
      { responseFormatJson: true, maxTokens: 700 }
    )

    if (!result || typeof result !== 'object') {
      return NextResponse.json({ error: 'Médiation indisponible pour le moment' }, { status: 502 })
    }
    const r = result as Record<string, unknown>
    const mediation: Mediation = {
      reframed: String(r.reframed ?? '').slice(0, 280),
      otherPerspective: String(r.otherPerspective ?? '').slice(0, 280),
      deescalation: String(r.deescalation ?? '').slice(0, 280),
      suggestion: String(r.suggestion ?? '').slice(0, 280),
    }

    // Journalise dans le fil (réutilisable à l'affichage, pas de re-génération).
    void addDyadEvent({
      dyadId: dyad.id,
      authorId: uid,
      type: 'mediation',
      content: JSON.stringify({ input: message.slice(0, 500), mediation, cached_at: new Date().toISOString() }),
    }).catch(() => {})

    return NextResponse.json({ mediation })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
