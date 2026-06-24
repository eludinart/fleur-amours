/**
 * Bloc parcours / fleur pour les e-mails utilisateur.
 */
import type { ServerLocale } from './i18n-server'
import { tServer } from './i18n-server'
import type { FleurEmailHero } from './email-layout'
import type { EngagementPersonalization } from './engagement-context'
import type { EngagementCampaignId } from './engagement-templates'

const ENGAGEMENT_CAMPAIGN_IDS = new Set<EngagementCampaignId>([
  'plan14j',
  'checkin',
  'tirage',
  'fleur',
  'session',
  'dreamscape',
])

export function campaignIdFromNotificationType(type: string): EngagementCampaignId | undefined {
  if (type === 'plan14j_reminder') return 'plan14j'
  if (type === 'checkin_reminder') return 'checkin'
  const match = type.match(/^engagement_(.+)$/)
  if (!match) return undefined
  const id = match[1] as EngagementCampaignId
  return ENGAGEMENT_CAMPAIGN_IDS.has(id) ? id : undefined
}

function hasPetalScores(p: EngagementPersonalization): boolean {
  return !!p.petalScores && Object.values(p.petalScores).some((v) => v > 0)
}

function pushCheckinChip(chips: string[], locale: ServerLocale, p: EngagementPersonalization) {
  if (p.daysSinceCheckin == null) return
  if (p.daysSinceCheckin <= 1) {
    chips.push(tServer(locale, 'email.journey.checkinRecent'))
  } else if (p.daysSinceCheckin <= 14) {
    chips.push(tServer(locale, 'email.journey.checkinStale', { days: p.daysSinceCheckin }))
  }
}

export function buildJourneyChips(
  locale: ServerLocale,
  p: EngagementPersonalization,
  campaignId?: EngagementCampaignId
): string[] {
  const chips: string[] = []

  if (p.hasFleurProfile || hasPetalScores(p)) {
    chips.push(tServer(locale, 'email.journey.hasFleur'))
  } else {
    chips.push(tServer(locale, 'email.journey.noFleur'))
  }

  switch (campaignId) {
    case 'plan14j': {
      if (p.plan14j && Number.isFinite(p.plan14j.currentDay) && p.plan14j.currentDay > 0) {
        chips.push(tServer(locale, 'email.journey.plan14j', { day: p.plan14j.currentDay }))
        if (Number.isFinite(p.plan14j.progressPct) && chips.length < 3) {
          chips.push(tServer(locale, 'email.journey.plan14jProgress', { progress: p.plan14j.progressPct }))
        }
      }
      break
    }
    case 'tirage': {
      if (p.lastCardName) {
        chips.push(tServer(locale, 'email.journey.lastTirage', { card: p.lastCardName }))
      } else if (p.dominantPetalName) {
        chips.push(tServer(locale, 'email.journey.dominantPetalChip', { petal: p.dominantPetalName }))
      }
      break
    }
    case 'checkin': {
      if (p.daysSinceCheckin == null) {
        chips.push(tServer(locale, 'email.journey.checkinPending'))
      } else if (p.daysSinceCheckin <= 1) {
        chips.push(tServer(locale, 'email.journey.checkinRecent'))
      } else {
        chips.push(tServer(locale, 'email.journey.checkinStale', { days: p.daysSinceCheckin }))
      }
      break
    }
    case 'session': {
      if (p.inProgressSessionId) {
        const door = p.inProgressDoor ?? tServer(locale, 'engagement.session.doorFallback')
        chips.push(tServer(locale, 'email.journey.sessionInProgress', { door }))
      } else if (p.shadowPetalName) {
        chips.push(tServer(locale, 'email.journey.dominantPetalChip', { petal: p.shadowPetalName }))
      }
      break
    }
    case 'fleur': {
      chips.push(tServer(locale, 'email.journey.discoverFleur'))
      break
    }
    case 'dreamscape': {
      chips.push(tServer(locale, 'email.journey.dreamscape'))
      break
    }
    default: {
      if (p.inProgressSessionId) {
        const door = p.inProgressDoor ?? tServer(locale, 'engagement.session.doorFallback')
        chips.push(tServer(locale, 'email.journey.sessionInProgress', { door }))
      }
    }
  }

  if (chips.length < 3 && campaignId !== 'checkin') {
    pushCheckinChip(chips, locale, p)
  }

  return chips.slice(0, 3)
}

export function resolveEmailHero(p: EngagementPersonalization): FleurEmailHero {
  if (hasPetalScores(p)) {
    return { type: 'flower', scores: p.petalScores! }
  }
  return { type: 'logo' }
}
