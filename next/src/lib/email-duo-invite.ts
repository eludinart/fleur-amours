/**
 * E-mail d'invitation Duo / À deux — contenu i18n dans la coquille unifiée.
 */
import { PETAL_DEFS, PETAL_BY_ID } from './petal-theme'
import { buildFleurEmailLayout, escapeEmailHtml } from './email-layout'
import {
  buildFlowerInlineAttachment,
  emailFlowerImgTag,
  EMAIL_FLOWER_CID,
  type EmailInlineAttachment,
} from './email-inline-attachments'
import { EMAIL_FLOWER_DISPLAY_SIZE } from './email-flower-png'
import { dominantPetalFromScores, normalizePetalsForEmail } from './email-flower-svg'
import { tServer, type ServerLocale } from './i18n-server'

export type DuoInviteEmailKind = 'a_deux_porte' | 'a_deux_complet' | 'duo_classic' | 'couple_garden'

export type DuoInviteEmailContentParams = {
  inviterName: string
  inviterDisplayName?: string | null
  inviteUrl: string
  scores: Record<string, number>
  kind: DuoInviteEmailKind
  porteKey?: string | null
  ctaLabel?: string
  locale?: string
}

function buildPetalLegendHtml(scores: Record<string, number>): string {
  const normalized = normalizePetalsForEmail(scores)
  const rows = PETAL_DEFS.map((def) => {
    const v = normalized[def.id] ?? 0
    const pct = Math.round(v * 100)
    return (
      `<tr>` +
      `<td style="padding:4px 8px 4px 0;font-size:12px;color:#475569;white-space:nowrap">${escapeEmailHtml(def.name)}</td>` +
      `<td style="padding:4px 0;width:100%">` +
      `<div style="background:#f1f5f9;border-radius:999px;height:8px;overflow:hidden">` +
      `<div style="background:${def.color};width:${Math.max(6, pct)}%;height:8px;border-radius:999px"></div>` +
      `</div>` +
      `</td>` +
      `</tr>`
    )
  }).join('')

  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:12px">` +
    rows +
    `</table>`
  )
}

function procedureSteps(
  locale: ServerLocale,
  kind: DuoInviteEmailKind
): Array<{ emoji: string; title: string; desc: string }> {
  const base = 'email.duo.steps'
  if (kind === 'couple_garden') {
    return [
      {
        emoji: '🌸',
        title: tServer(locale, `${base}.discoverTitle`),
        desc: tServer(locale, `${base}.discoverDesc`),
      },
      {
        emoji: '🤝',
        title: tServer(locale, `${base}.acceptTitle`),
        desc: tServer(locale, `${base}.acceptDescGarden`),
      },
      {
        emoji: '💫',
        title: tServer(locale, `${base}.cultivateTitle`),
        desc: tServer(locale, `${base}.cultivateDesc`),
      },
    ]
  }
  const answerDesc =
    kind === 'a_deux_porte'
      ? tServer(locale, `${base}.answerDescPorte`)
      : tServer(locale, `${base}.answerDescComplet`)
  return [
    {
      emoji: '🌸',
      title: tServer(locale, `${base}.discoverTitle`),
      desc: tServer(locale, `${base}.discoverDesc`),
    },
    {
      emoji: '✨',
      title: tServer(locale, `${base}.answerTitle`),
      desc: answerDesc,
    },
    {
      emoji: '💫',
      title: tServer(locale, `${base}.togetherTitle`),
      desc: tServer(locale, `${base}.togetherDesc`),
    },
  ]
}

function kindMeta(
  locale: ServerLocale,
  kind: DuoInviteEmailKind,
  porteKey?: string | null
): { badge: string; duration: string } {
  if (kind === 'couple_garden') {
    return {
      badge: tServer(locale, 'email.duo.badgeGarden'),
      duration: tServer(locale, 'email.duo.badgeGardenDuration'),
    }
  }
  if (kind === 'a_deux_porte') {
    const porte = porteKey
      ? tServer(locale, `email.duo.porte.${porteKey}`, {}) || porteKey
      : 'Porte'
    return {
      badge: tServer(locale, 'email.duo.badgePorte', { porte }),
      duration: tServer(locale, 'email.duo.duration5'),
    }
  }
  if (kind === 'a_deux_complet') {
    return {
      badge: tServer(locale, 'email.duo.badgeComplet'),
      duration: tServer(locale, 'email.duo.duration15'),
    }
  }
  return {
    badge: tServer(locale, 'email.duo.badgeDuo'),
    duration: tServer(locale, 'email.duo.duration15'),
  }
}

export async function buildDuoInviteEmailContent(
  params: DuoInviteEmailContentParams
): Promise<{ html: string; text: string; subject: string; inlineImages?: EmailInlineAttachment[] }> {
  const locale = (params.locale ?? 'fr') as ServerLocale
  const inviter = params.inviterName.trim() || '…'
  const display = params.inviterDisplayName?.trim() || inviter
  const meta = kindMeta(locale, params.kind, params.porteKey)
  const dominant = dominantPetalFromScores(params.scores)
  const cta =
    params.ctaLabel ??
    (params.kind === 'couple_garden'
      ? tServer(locale, 'email.duo.ctaGarden')
      : tServer(locale, 'email.duo.ctaQuestionnaire'))
  const steps = procedureSteps(locale, params.kind)

  const headingTitle =
    params.kind === 'couple_garden'
      ? tServer(locale, 'email.duo.headingGarden')
      : tServer(locale, 'email.duo.headingPorte')
  const introLine =
    params.kind === 'couple_garden'
      ? tServer(locale, 'email.duo.introGarden')
      : tServer(locale, 'email.duo.introPorte')

  const subject =
    params.kind === 'duo_classic'
      ? `${tServer(locale, 'email.duo.subjectDuo', { inviter })} 🌸`
      : params.kind === 'couple_garden'
        ? `${tServer(locale, 'email.duo.subjectGarden', { inviter })} 🌸`
        : `${tServer(locale, 'email.duo.subjectPorte', { inviter })} 🌸`

  const flowerAttachment = await buildFlowerInlineAttachment(params.scores)

  const flowerBlock =
    `<p style="margin:0 0 12px;font-size:12px;font-family:system-ui,sans-serif;color:#7c3aed;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;text-align:center">${escapeEmailHtml(tServer(locale, 'email.duo.flowerOf', { name: display }))}</p>` +
    `<div style="text-align:center;margin-bottom:8px">` +
    emailFlowerImgTag(EMAIL_FLOWER_CID, EMAIL_FLOWER_DISPLAY_SIZE) +
    `</div>` +
    (dominant
      ? `<p style="margin:0 0 8px;font-size:14px;color:#64748b;font-family:system-ui,sans-serif;text-align:center">${escapeEmailHtml(tServer(locale, 'email.journey.dominantPetalPrefix'))} <strong style="color:${PETAL_BY_ID[dominant.id]?.color ?? '#7c3aed'}">${escapeEmailHtml(dominant.name)}</strong></p>`
      : '') +
    buildPetalLegendHtml(params.scores)

  const stepsHtml = steps
    .map(
      (s, i) =>
        `<div style="margin:0 0 14px;padding:16px 18px;background:#fafafa;border-radius:16px;border:1px solid #e2e8f0">` +
        `<p style="margin:0 0 4px;font-size:13px;color:#7c3aed;font-weight:700;font-family:system-ui,sans-serif">${escapeEmailHtml(tServer(locale, 'email.duo.step', { n: i + 1 }))}</p>` +
        `<p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#1e293b">${s.emoji} ${escapeEmailHtml(s.title)}</p>` +
        `<p style="margin:0;font-size:14px;line-height:1.55;color:#64748b">${escapeEmailHtml(s.desc)}</p>` +
        `</div>`
    )
    .join('')

  const extraHtml =
    flowerBlock +
    `<h2 style="margin:24px 0 14px;font-size:18px;color:#1e293b;font-family:system-ui,sans-serif">${escapeEmailHtml(tServer(locale, 'email.duo.howItWorks'))}</h2>` +
    stepsHtml +
    `<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;font-family:system-ui,sans-serif;text-align:center">${escapeEmailHtml(tServer(locale, 'email.duo.footerNote'))}</p>`

  const { html, text: layoutText } = buildFleurEmailLayout({
    locale,
    title: headingTitle,
    subtitle: `<strong>${escapeEmailHtml(display)}</strong> ${escapeEmailHtml(introLine)}`,
    badge: `${meta.badge} · ${meta.duration}`,
    hero: { type: 'none' },
    extraHtml,
    cta: { label: cta, url: params.inviteUrl },
  })

  const text = [
    subject,
    '',
    `${display} — ${introLine}`,
    meta.badge,
    dominant ? `${tServer(locale, 'email.journey.dominantPetalPrefix')} ${dominant.name}` : '',
    '',
    tServer(locale, 'email.duo.howItWorks'),
    ...steps.map((s, i) => `${i + 1}. ${s.title} — ${s.desc}`),
    '',
    `${cta} : ${params.inviteUrl}`,
    '',
    layoutText,
  ]
    .filter(Boolean)
    .join('\n')

  return { html, text, subject, inlineImages: [flowerAttachment] }
}
