/**
 * Modèles notification in-app + e-mail pour les relances d'engagement.
 * 5 langues, contenu enrichi et personnalisé selon le profil utilisateur.
 */
import { buildNotificationEmailHtml } from './email'
import { embedInlineImagesForPreview } from './email-inline-attachments'
import { tServer } from './i18n-server'
import type { ServerLocale } from './i18n-server'
import type { EngagementPersonalization } from './engagement-context'

export type EngagementCampaignId =
  | 'plan14j'
  | 'checkin'
  | 'tirage'
  | 'fleur'
  | 'session'
  | 'dreamscape'

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
}

export type EngagementTemplateVars = {
  day?: number
  action?: string
  planProgressPct?: number
  /** Session terminée portant le plan 14j en cours (relance plan14j). */
  sessionId?: number
  personalization?: EngagementPersonalization
}

const ENGAGEMENT_TYPES = new Set([
  'plan14j_reminder',
  'checkin_reminder',
  'engagement_tirage',
  'engagement_fleur',
  'engagement_session',
  'engagement_dreamscape',
])

export function isEngagementNotificationType(type: string): boolean {
  return ENGAGEMENT_TYPES.has(type) || type.startsWith('engagement_')
}

/** Expiration par défaut des relances (évite d'encombrer la cloche). */
export function engagementExpiresAt(hours = 36): string {
  const d = new Date()
  d.setHours(d.getHours() + hours)
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

function greeting(locale: ServerLocale, name: string): string {
  if (name) return tServer(locale, 'engagement.greeting', { name })
  return tServer(locale, 'engagement.greetingGeneric')
}

function resolveActionUrl(
  campaignId: EngagementCampaignId,
  vars: EngagementTemplateVars
): string {
  const p = vars.personalization
  switch (campaignId) {
    case 'plan14j': {
      const sessionId = vars.sessionId ?? p?.plan14jSessionId
      if (sessionId) return `/session?open=${sessionId}`
      return '/session'
    }
    case 'checkin':
      return '/checkin'
    case 'tirage':
      return '/tirage'
    case 'fleur':
      return '/a-deux/par-une-porte?welcome=1'
    case 'session':
      if (p?.inProgressSessionId) return `/session/${p.inProgressSessionId}`
      return '/session?mode=single'
    case 'dreamscape':
      return '/dreamscape'
    default:
      return '/'
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

  if (p?.dominantPetalName && campaignId !== 'fleur') {
    lines.push(tServer(locale, 'engagement.contextDominantPetal', { petal: p.dominantPetalName }))
  }

  switch (campaignId) {
    case 'plan14j': {
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
    case 'tirage': {
      lines.push(tServer(locale, `${baseKey}.body`, {}))
      if (p?.lastCardName) {
        return {
          body: lines.join('\n\n'),
          highlight: tServer(locale, `${baseKey}.highlightLastCard`, { card: p.lastCardName }),
        }
      }
      if (p?.shadowPetalName) {
        return {
          body: lines.join('\n\n'),
          highlight: tServer(locale, `${baseKey}.highlightPetal`, { petal: p.shadowPetalName }),
        }
      }
      return { body: lines.join('\n\n'), highlight: null }
    }
    case 'session': {
      if (p?.inProgressSessionId) {
        lines.push(
          tServer(locale, `${baseKey}.bodyResume`, {
            door: p.inProgressDoor ?? tServer(locale, 'engagement.session.doorFallback'),
          })
        )
      } else {
        lines.push(tServer(locale, `${baseKey}.body`, {}))
        if (p?.shadowPetalName) {
          return {
            body: lines.join('\n\n'),
            highlight: tServer(locale, `${baseKey}.highlightPetal`, { petal: p.shadowPetalName }),
          }
        }
      }
      return { body: lines.join('\n\n'), highlight: null }
    }
    default:
      lines.push(tServer(locale, `${baseKey}.body`, {}))
      return { body: lines.join('\n\n'), highlight: null }
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

  const titleVars: Record<string, string | number> = { day: vars.day ?? 1 }
  const title = tServer(loc, `${baseKey}.title`, titleVars)
  const action_url = resolveActionUrl(campaignId, vars)
  const action_label =
    campaignId === 'session' && vars.personalization?.inProgressSessionId
      ? tServer(loc, `${baseKey}.actionLabelResume`)
      : tServer(loc, `${baseKey}.actionLabel`)

  return {
    type:
      campaignId === 'plan14j'
        ? 'plan14j_reminder'
        : campaignId === 'checkin'
          ? 'checkin_reminder'
          : `engagement_${campaignId}`,
    title,
    body,
    action_url,
    action_label,
    priority: campaignId === 'fleur' ? 'normal' : 'low',
    emailSubject: tServer(loc, `${baseKey}.emailSubject`, titleVars),
    emailHighlight: highlight,
    locale: loc,
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

/** Exemple plan 14j pour démo / preview admin */
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
