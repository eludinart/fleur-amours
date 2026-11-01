/**
 * Modèles notification in-app + e-mail pour les relances d'engagement.
 */
import { buildNotificationEmailHtml } from './email'
import { embedInlineImagesForPreview } from './email-inline-attachments'
import { dailyCardLoginPath } from './daily-card'
import { tServer } from './i18n-server'
import type { ServerLocale } from './i18n-server'
import type { EngagementPersonalization } from './engagement-context'

export type EngagementCampaignId =
  | 'plan14j'
  | 'plan14j_closing'
  | 'checkin'
  | 'checkin_echo'
  | 'tirage'
  | 'carte_du_jour'
  | 'carte_dimanche'
  | 'serie_j2'
  | 'serie_j3'
  | 'fleur'
  | 'session'
  | 'dreamscape'
  | 'earlyreturn'
  | 'comeback'
  | 'duo_same_petal'

/** Campagnes quotidiennes : hors cooldown hebdo global. */
export const DAILY_ENGAGEMENT_CAMPAIGNS = new Set<EngagementCampaignId>([
  'carte_du_jour',
  'carte_dimanche',
  'serie_j2',
  'serie_j3',
])

export function bypassesGlobalCooldown(campaignId: EngagementCampaignId): boolean {
  return DAILY_ENGAGEMENT_CAMPAIGNS.has(campaignId)
}

export type EngagementTemplate = {
  type: string
  title: string
  body: string
  action_url: string
  action_label: string
  priority: 'low' | 'normal'
  emailSubject: string
  emailHighlight: string | null
  locale: ServerLocale
  pushTitle?: string
  pushBody?: string
}

export type EngagementTemplateVars = {
  day?: number
  action?: string
  planProgressPct?: number
  sessionId?: number
  question?: string
  microGeste?: string
  door?: string
  personalization?: EngagementPersonalization
}

export function isEngagementNotificationType(type: string): boolean {
  return (
    type === 'plan14j_reminder' ||
    type === 'checkin_reminder' ||
    type === 'checkin_echo' ||
    type.startsWith('engagement_')
  )
}

export function engagementExpiresAt(hours = 36): string {
  const d = new Date()
  d.setHours(d.getHours() + hours)
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

function greeting(locale: ServerLocale, name: string): string {
  if (name) return tServer(locale, 'engagement.greeting', { name })
  return tServer(locale, 'engagement.greetingGeneric')
}

function cardKey(p?: EngagementPersonalization | null): string | null {
  return p?.dailyCard?.name || p?.dailyCard?.slug || null
}

function resolveActionUrl(
  campaignId: EngagementCampaignId,
  vars: EngagementTemplateVars
): string {
  const p = vars.personalization
  const ck = cardKey(p)
  switch (campaignId) {
    case 'plan14j':
    case 'plan14j_closing': {
      const sessionId = vars.sessionId ?? p?.plan14jSessionId
      if (sessionId) return `/session?open=${sessionId}`
      return '/session'
    }
    case 'checkin':
    case 'checkin_echo':
      return '/checkin'
    case 'tirage':
    case 'carte_du_jour':
    case 'carte_dimanche':
    case 'serie_j2':
      return ck ? dailyCardLoginPath(ck) : '/tirage'
    case 'serie_j3':
      return '/checkin'
    case 'fleur':
      return '/a-deux/par-une-porte?welcome=1'
    case 'session':
    case 'earlyreturn':
      if (p?.inProgressSessionId) return `/session/${p.inProgressSessionId}`
      return p?.hasFleurProfile ? '/checkin' : '/tirage'
    case 'dreamscape':
      return '/dreamscape'
    case 'comeback':
      return '/tirage'
    case 'duo_same_petal':
      return '/a-deux'
    default: {
      const _exhaustive: never = campaignId
      return _exhaustive
    }
  }
}

function buildRichBody(
  locale: ServerLocale,
  campaignId: EngagementCampaignId,
  vars: EngagementTemplateVars
): { body: string; highlight: string | null } {
  const p = vars.personalization
  const greet = greeting(locale, p?.displayName ?? '')
  const baseKey = `engagement.${campaignId}`
  const lines: string[] = [greet]
  const card = p?.dailyCard

  const withPetalContext = () => {
    if (p?.dominantPetalName && campaignId !== 'fleur') {
      lines.push(tServer(locale, 'engagement.contextDominantPetal', { petal: p.dominantPetalName }))
    }
  }

  switch (campaignId) {
    case 'plan14j': {
      withPetalContext()
      const day = vars.day ?? 1
      const progress = vars.planProgressPct ?? 0
      lines.push(tServer(locale, `${baseKey}.body`, { day, progress }))
      if (vars.action) {
        return {
          body: lines.join('\n\n'),
          highlight: tServer(locale, `${baseKey}.highlight`, { action: vars.action }),
        }
      }
      return { body: lines.join('\n\n'), highlight: null }
    }
    case 'plan14j_closing': {
      lines.push(tServer(locale, `${baseKey}.body`, {}))
      return {
        body: lines.join('\n\n'),
        highlight: tServer(locale, `${baseKey}.highlight`),
      }
    }
    case 'tirage':
    case 'carte_du_jour':
    case 'carte_dimanche': {
      withPetalContext()
      if (card) {
        const blurb = card.shortDescription || tServer(locale, 'engagement.tirage.bodyFallback', {})
        const bodyKey =
          campaignId === 'carte_dimanche'
            ? 'engagement.carte_dimanche.bodyWithCard'
            : 'engagement.tirage.bodyWithCard'
        lines.push(tServer(locale, bodyKey, { card: card.name, blurb }))
        if (vars.question) {
          return {
            body: lines.join('\n\n'),
            highlight: tServer(locale, 'engagement.serie_j2.highlight', { question: vars.question }),
          }
        }
        return {
          body: lines.join('\n\n'),
          highlight: tServer(locale, 'engagement.tirage.highlightInvite'),
        }
      }
      lines.push(tServer(locale, 'engagement.tirage.body', {}))
      return { body: lines.join('\n\n'), highlight: null }
    }
    case 'serie_j2': {
      withPetalContext()
      const q = vars.question || tServer(locale, 'engagement.serie_j2.questionFallback')
      lines.push(
        tServer(locale, 'engagement.serie_j2.body', {
          card: card?.name ?? '',
          question: q,
        })
      )
      return {
        body: lines.join('\n\n'),
        highlight: tServer(locale, 'engagement.serie_j2.highlight', { question: q }),
      }
    }
    case 'serie_j3': {
      withPetalContext()
      const geste = vars.microGeste || tServer(locale, 'engagement.serie_j3.gesteFallback')
      lines.push(tServer(locale, 'engagement.serie_j3.body', { geste }))
      return {
        body: lines.join('\n\n'),
        highlight: tServer(locale, 'engagement.serie_j3.highlight', { geste }),
      }
    }
    case 'checkin_echo': {
      lines.push(tServer(locale, `${baseKey}.body`, {}))
      return {
        body: lines.join('\n\n'),
        highlight: tServer(locale, `${baseKey}.highlight`),
      }
    }
    case 'session': {
      withPetalContext()
      if (p?.inProgressSessionId) {
        lines.push(
          tServer(locale, `${baseKey}.bodyResume`, {
            door: p.inProgressDoor ?? tServer(locale, 'engagement.session.doorFallback'),
          })
        )
      } else {
        lines.push(tServer(locale, `${baseKey}.body`, {}))
      }
      return { body: lines.join('\n\n'), highlight: null }
    }
    case 'earlyreturn': {
      const door =
        vars.door || p?.inProgressDoor || tServer(locale, 'engagement.session.doorFallback')
      lines.push(tServer(locale, `${baseKey}.bodyWithDoor`, { door }))
      if (p?.dominantPetalName) {
        return {
          body: lines.join('\n\n'),
          highlight: tServer(locale, `${baseKey}.highlight`, { petal: p.dominantPetalName }),
        }
      }
      return {
        body: lines.join('\n\n'),
        highlight: tServer(locale, `${baseKey}.highlightGeneric`),
      }
    }
    case 'comeback': {
      lines.push(tServer(locale, `${baseKey}.body`, {}))
      if (p?.dominantPetalName) {
        return {
          body: lines.join('\n\n'),
          highlight: tServer(locale, `${baseKey}.highlight`, { petal: p.dominantPetalName }),
        }
      }
      return { body: lines.join('\n\n'), highlight: tServer(locale, `${baseKey}.highlightGeneric`) }
    }
    case 'duo_same_petal': {
      lines.push(
        tServer(locale, `${baseKey}.body`, {
          petal: p?.dominantPetalName ?? '',
        })
      )
      return {
        body: lines.join('\n\n'),
        highlight: tServer(locale, `${baseKey}.highlight`, {
          petal: p?.dominantPetalName ?? '',
        }),
      }
    }
    case 'checkin':
    case 'fleur':
    case 'dreamscape':
    default: {
      withPetalContext()
      lines.push(tServer(locale, `${baseKey}.body`, {}))
      return { body: lines.join('\n\n'), highlight: null }
    }
  }
}

export function buildEngagementTemplate(
  campaignId: EngagementCampaignId,
  locale?: string,
  vars: EngagementTemplateVars = {}
): EngagementTemplate {
  const loc = (vars.personalization?.locale ?? locale ?? 'fr') as ServerLocale
  const baseKey = `engagement.${campaignId}`
  const { body, highlight } = buildRichBody(loc, campaignId, vars)
  const dailyCard = vars.personalization?.dailyCard
  const titleVars: Record<string, string | number> = {
    day: vars.day ?? 1,
    card: dailyCard?.name ?? '',
    door: vars.door || vars.personalization?.inProgressDoor || '',
    petal: vars.personalization?.dominantPetalName ?? '',
  }

  const cardCampaigns = new Set(['tirage', 'carte_du_jour', 'carte_dimanche', 'serie_j2'])
  const useCardTitle = cardCampaigns.has(campaignId) && !!dailyCard

  const title = useCardTitle
    ? tServer(
        loc,
        campaignId === 'carte_dimanche'
          ? 'engagement.carte_dimanche.titleWithCard'
          : campaignId === 'serie_j2'
            ? 'engagement.serie_j2.title'
            : 'engagement.tirage.titleWithCard',
        titleVars
      )
    : tServer(loc, `${baseKey}.title`, titleVars)

  const action_url = resolveActionUrl(campaignId, vars)
  let action_label = tServer(loc, `${baseKey}.actionLabel`, titleVars)
  if (campaignId === 'session' && vars.personalization?.inProgressSessionId) {
    action_label = tServer(loc, 'engagement.session.actionLabelResume')
  } else if (useCardTitle) {
    action_label = tServer(loc, 'engagement.tirage.actionLabelConnect')
  }

  const emailSubject = useCardTitle
    ? tServer(
        loc,
        campaignId === 'carte_dimanche'
          ? 'engagement.carte_dimanche.emailSubjectWithCard'
          : 'engagement.tirage.emailSubjectWithCard',
        titleVars
      )
    : tServer(loc, `${baseKey}.emailSubject`, titleVars)

  const pushTitle = tServer(loc, `${baseKey}.pushTitle`, titleVars)
  const pushBody = tServer(loc, `${baseKey}.pushBody`, titleVars)

  return {
    type:
      campaignId === 'plan14j'
        ? 'plan14j_reminder'
        : campaignId === 'checkin'
          ? 'checkin_reminder'
          : campaignId === 'checkin_echo'
            ? 'checkin_echo'
            : `engagement_${campaignId}`,
    title,
    body,
    action_url,
    action_label,
    priority:
      campaignId === 'fleur' || campaignId === 'earlyreturn' || campaignId === 'plan14j_closing'
        ? 'normal'
        : 'low',
    emailSubject,
    emailHighlight: highlight,
    locale: loc,
    pushTitle: pushTitle && !pushTitle.startsWith('engagement.') ? pushTitle : title,
    pushBody: pushBody && !pushBody.startsWith('engagement.') ? pushBody : body.slice(0, 120),
  }
}

export async function buildEngagementEmailPreview(
  campaignId: EngagementCampaignId,
  locale?: string,
  vars: EngagementTemplateVars = {}
): Promise<{ subject: string; html: string; text: string; template: EngagementTemplate }> {
  const template = buildEngagementTemplate(campaignId, locale, vars)
  const { html, text, inlineImages } = await buildNotificationEmailHtml({
    title: template.title,
    body: template.body,
    actionUrl: template.action_url,
    actionLabel: template.action_label,
    locale: template.locale,
    highlight: template.emailHighlight,
    personalization: vars.personalization,
    preheader: template.emailHighlight ?? template.body.slice(0, 120),
    campaignId,
  })
  return {
    subject: template.emailSubject,
    html: inlineImages ? embedInlineImagesForPreview(html, inlineImages) : html,
    text,
    template,
  }
}

export const PLAN14J_PREVIEW_VARS: EngagementTemplateVars = {
  day: 3,
  action: "Noter une micro-gratitude envers quelqu'un qui vous soutient.",
  planProgressPct: 21,
  personalization: {
    locale: 'fr',
    displayName: 'Marie',
    pseudo: 'marie',
    dominantPetalId: 'agape',
    dominantPetalName: 'Agapè',
    shadowPetalName: null,
    lastCardName: 'Philia',
    dailyCard: {
      slug: 'philia',
      name: 'PHILIA',
      imageFile: 'philia.png',
      shortDescription:
        "Représente l'amour fraternel, l'amitié sincère et le lien d'âme à âme. Une invitation à cultiver la confiance et le partage.",
      imageUrl: 'https://eludein.art/cartes/philia.png',
    },
    inProgressSessionId: null,
    inProgressDoor: null,
    petalScores: {
      agape: 0.85,
      philautia: 0.4,
      mania: 0.2,
      storge: 0.55,
      pragma: 0.35,
      philia: 0.7,
      ludus: 0.45,
      eros: 0.5,
    },
    hasFleurProfile: true,
    plan14j: { currentDay: 3, progressPct: 21 },
    plan14jSessionId: 1,
    daysSinceCheckin: 2,
  },
}

export const PREVIEW_PERSONALIZATIONS: Record<ServerLocale, EngagementPersonalization> = {
  fr: PLAN14J_PREVIEW_VARS.personalization!,
  en: {
    ...PLAN14J_PREVIEW_VARS.personalization!,
    locale: 'en',
    displayName: 'Marie',
    dominantPetalName: 'Agape',
    lastCardName: 'Philia',
  },
  es: {
    ...PLAN14J_PREVIEW_VARS.personalization!,
    locale: 'es',
    displayName: 'María',
    dominantPetalName: 'Ágape',
    lastCardName: 'Filía',
  },
  it: {
    ...PLAN14J_PREVIEW_VARS.personalization!,
    locale: 'it',
    displayName: 'Maria',
    dominantPetalName: 'Agape',
    lastCardName: 'Filía',
  },
  de: {
    ...PLAN14J_PREVIEW_VARS.personalization!,
    locale: 'de',
    displayName: 'Marie',
    dominantPetalName: 'Agape',
    lastCardName: 'Philia',
  },
}
