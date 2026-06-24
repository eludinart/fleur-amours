/**
 * GET /api/engagement/preview
 * Aperçu admin des modèles notification + e-mail (5 langues).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, ApiError } from '@/lib/api-auth'
import {
  buildEngagementEmailPreview,
  PLAN14J_PREVIEW_VARS,
  PREVIEW_PERSONALIZATIONS,
  type EngagementCampaignId,
} from '@/lib/engagement-templates'
import { normalizeServerLocale } from '@/lib/i18n-server'

export const dynamic = 'force-dynamic'

const ALL_CAMPAIGNS: EngagementCampaignId[] = [
  'plan14j',
  'checkin',
  'tirage',
  'fleur',
  'session',
  'dreamscape',
  'comeback',
]

function isCampaignId(v: string): v is EngagementCampaignId {
  return (ALL_CAMPAIGNS as string[]).includes(v)
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    const { searchParams } = new URL(req.url)
    const locale = normalizeServerLocale(searchParams.get('locale') ?? 'fr')
    const campaignParam = searchParams.get('campaign')

    const campaigns = campaignParam && isCampaignId(campaignParam) ? [campaignParam] : ALL_CAMPAIGNS
    const personalization = PREVIEW_PERSONALIZATIONS[locale] ?? PREVIEW_PERSONALIZATIONS.fr

    const previews = await Promise.all(
      campaigns.map(async (id) => {
        const vars =
          id === 'plan14j'
            ? { ...PLAN14J_PREVIEW_VARS, personalization }
            : { personalization }
        const email = await buildEngagementEmailPreview(id, locale, vars)
        return {
          campaignId: id,
          notification: {
            type: email.template.type,
            title: email.template.title,
            body: email.template.body,
            action_url: email.template.action_url,
            action_label: email.template.action_label,
            priority: email.template.priority,
          },
          email: {
            subject: email.subject,
            html: email.html,
            text: email.text,
          },
        }
      })
    )

    return NextResponse.json({
      locale,
      supportedLocales: ['fr', 'en', 'es', 'it', 'de'],
      campaigns: previews,
      expiryHours: 36,
      devNote: 'En développement, seuls les envois vers eludinart@gmail.com sont livrés.',
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    const status = err instanceof ApiError ? err.status : e.status || 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
