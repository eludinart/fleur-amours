/**
 * E-mail de clôture — Conversation intérieure (rendu structuré + fleur + snapshot + cartes).
 */
import { buildFleurEmailLayout, escapeEmailHtml } from './email-layout'
import {
  resolveHeroInlineAttachments,
  type EmailInlineAttachment,
} from './email-inline-attachments'
import { sendTransactionalEmail } from './email'
import { authMe } from './db-auth'
import { tServer, type ServerLocale } from './i18n-server'
import { resolveEmailLocale } from './user-locale'
import { ALL_CARDS } from '@/data/tarotCards'

export type DreamscapeClosingSections = {
  intention_depart?: string | null
  ce_qui_a_emerge?: string | null
  trajectoire_cartes?: string | null
  citations?: string[]
  actions_a_oeuvrer?: string[]
}

export type DreamscapeClosingSlot = {
  position?: string
  card?: string
  faceDown?: boolean
  revealOrder?: number
}

const SNAPSHOT_CID = 'dreamscape-snapshot@fleurdamours'
const CARD_CID_PREFIX = 'dreamscape-card'

function sectionBlock(title: string, bodyHtml: string): string {
  return (
    `<div style="margin:0 0 18px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">` +
    `<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#7c3aed;font-family:system-ui,-apple-system,sans-serif">${escapeEmailHtml(title)}</p>` +
    bodyHtml +
    `</div>`
  )
}

function textBody(body: string): string {
  return `<p style="margin:0;color:#334155;font-size:15px;line-height:1.65;font-family:Georgia,'Times New Roman',serif;white-space:pre-wrap">${escapeEmailHtml(body).replace(/\n/g, '<br>')}</p>`
}

function listBlock(title: string, items: string[], color = '#7c3aed'): string {
  if (!items.length) return ''
  const lis = items
    .map(
      (it) =>
        `<li style="margin:0 0 6px;color:#334155;font-size:15px;line-height:1.5;font-family:Georgia,'Times New Roman',serif">${escapeEmailHtml(it)}</li>`
    )
    .join('')
  return (
    `<div style="margin:0 0 18px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">` +
    `<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${color};font-family:system-ui,-apple-system,sans-serif">${escapeEmailHtml(title)}</p>` +
    `<ul style="margin:0;padding-left:18px">${lis}</ul>` +
    `</div>`
  )
}

function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

export function findCardImageUrl(cardName: string): string | null {
  const n = normName(cardName)
  if (!n) return null
  const card = ALL_CARDS.find((c) => {
    const cn = normName(c.name)
    return cn === n || cn.includes(n) || n.includes(cn)
  })
  const img = card?.img
  if (!img || typeof img !== 'string') return null
  if (img.startsWith('http://') || img.startsWith('https://')) return img
  return null
}

function parseDataUrl(dataUrl: string): { contentType: string; buffer: Buffer } | null {
  const m = String(dataUrl || '').match(/^data:([^;]+);base64,([\s\S]+)$/)
  if (!m) return null
  try {
    return { contentType: m[1], buffer: Buffer.from(m[2], 'base64') }
  } catch {
    return null
  }
}

async function fetchCardAsCid(
  url: string,
  index: number
): Promise<{ src: string; attachment?: EmailInlineAttachment }> {
  const cid = `${CARD_CID_PREFIX}-${index}@fleurdamours`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return { src: url }
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 200 || buf.length > 2_500_000) return { src: url }
    const contentType = res.headers.get('content-type') || 'image/png'
    return {
      src: `cid:${cid}`,
      attachment: {
        cid,
        filename: `carte-${index + 1}.png`,
        content: buf,
        contentType: contentType.split(';')[0].trim() || 'image/png',
      },
    }
  } catch {
    return { src: url }
  }
}

function buildSnapshotBlock(locale: ServerLocale, src: string): string {
  const title = tServer(locale, 'email.dreamscapeClosing.snapshotTitle')
  return (
    `<div style="margin:0 0 20px;text-align:center">` +
    `<p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#7c3aed;font-family:system-ui,-apple-system,sans-serif">${escapeEmailHtml(title)}</p>` +
    `<img src="${escapeEmailHtml(src)}" alt="${escapeEmailHtml(title)}" width="480" style="display:block;margin:0 auto;max-width:100%;width:100%;height:auto;max-height:320px;object-fit:contain;border-radius:14px;border:1px solid #e9e5ff;background:#05030c"/>` +
    `</div>`
  )
}

function buildCardsStripHtml(
  locale: ServerLocale,
  cards: Array<{ name: string; position?: string; src: string }>,
  trajectoryText?: string
): string {
  if (!cards.length && !trajectoryText?.trim()) return ''
  const title = tServer(locale, 'email.dreamscapeClosing.trajectory')
  const cells = cards
    .map((c) => {
      const label = c.position || c.name
      const sub = c.position && c.name !== c.position ? c.name : ''
      return (
        `<td align="center" valign="top" style="padding:4px 5px">` +
        `<img src="${escapeEmailHtml(c.src)}" alt="${escapeEmailHtml(c.name)}" width="56" height="80" style="display:block;width:56px;height:80px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;background:#0f172a"/>` +
        `<p style="margin:6px 0 0;font-size:10px;line-height:1.25;font-weight:700;color:#5b21b6;font-family:system-ui,-apple-system,sans-serif;max-width:64px">${escapeEmailHtml(label)}</p>` +
        (sub
          ? `<p style="margin:2px 0 0;font-size:9px;line-height:1.2;color:#64748b;font-family:system-ui,-apple-system,sans-serif;max-width:64px">${escapeEmailHtml(sub)}</p>`
          : '') +
        `</td>`
      )
    })
    .join('')

  const strip = cards.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 12px"><tr>${cells}</tr></table>`
    : ''
  const trajHtml = trajectoryText?.trim()
    ? textBody(trajectoryText.trim())
    : ''

  return sectionBlock(title, strip + trajHtml)
}

export function buildDreamscapeClosingBodyHtml(params: {
  sections: DreamscapeClosingSections
  locale: ServerLocale
  path?: string[]
  snapshotSrc?: string | null
  cardImages?: Array<{ name: string; position?: string; src: string }>
}): string {
  const { sections, locale, path, snapshotSrc, cardImages } = params
  const parts: string[] = []
  const intro = tServer(locale, 'email.dreamscapeClosing.intro')
  parts.push(
    `<p style="margin:0 0 18px;color:#475569;font-size:15px;line-height:1.65;font-family:Georgia,'Times New Roman',serif">${escapeEmailHtml(intro)}</p>`
  )
  if (snapshotSrc) {
    parts.push(buildSnapshotBlock(locale, snapshotSrc))
  }
  if (sections.intention_depart?.trim()) {
    parts.push(
      sectionBlock(
        tServer(locale, 'email.dreamscapeClosing.intention'),
        textBody(sections.intention_depart.trim())
      )
    )
  }
  if (sections.ce_qui_a_emerge?.trim()) {
    parts.push(
      sectionBlock(
        tServer(locale, 'email.dreamscapeClosing.emerged'),
        textBody(sections.ce_qui_a_emerge.trim())
      )
    )
  }
  const traj =
    sections.trajectoire_cartes?.trim() ||
    (path?.length ? path.join(' → ') : '')
  const cardsBlock = buildCardsStripHtml(locale, cardImages ?? [], traj)
  if (cardsBlock) {
    parts.push(cardsBlock)
  } else if (traj) {
    parts.push(sectionBlock(tServer(locale, 'email.dreamscapeClosing.trajectory'), textBody(traj)))
  }
  if (Array.isArray(sections.citations) && sections.citations.length) {
    parts.push(listBlock(tServer(locale, 'email.dreamscapeClosing.quotes'), sections.citations.slice(0, 4)))
  }
  if (Array.isArray(sections.actions_a_oeuvrer) && sections.actions_a_oeuvrer.length) {
    parts.push(
      listBlock(
        tServer(locale, 'email.dreamscapeClosing.actions'),
        sections.actions_a_oeuvrer.slice(0, 7),
        '#059669'
      )
    )
  }
  return parts.join('')
}

export function buildDreamscapeClosingText(
  sections: DreamscapeClosingSections,
  locale: ServerLocale,
  path?: string[]
): string {
  const lines: string[] = [tServer(locale, 'email.dreamscapeClosing.intro'), '']
  if (sections.intention_depart?.trim()) {
    lines.push(tServer(locale, 'email.dreamscapeClosing.intention'), sections.intention_depart.trim(), '')
  }
  if (sections.ce_qui_a_emerge?.trim()) {
    lines.push(tServer(locale, 'email.dreamscapeClosing.emerged'), sections.ce_qui_a_emerge.trim(), '')
  }
  const traj = sections.trajectoire_cartes?.trim() || (path?.length ? path.join(' → ') : '')
  if (traj) {
    lines.push(tServer(locale, 'email.dreamscapeClosing.trajectory'), traj, '')
  }
  if (sections.citations?.length) {
    lines.push(tServer(locale, 'email.dreamscapeClosing.quotes'))
    sections.citations.slice(0, 4).forEach((c) => lines.push(`- ${c}`))
    lines.push('')
  }
  if (sections.actions_a_oeuvrer?.length) {
    lines.push(tServer(locale, 'email.dreamscapeClosing.actions'))
    sections.actions_a_oeuvrer.slice(0, 7).forEach((a) => lines.push(`- ${a}`))
  }
  return lines.join('\n')
}

function resolveRevealedCards(
  slots?: DreamscapeClosingSlot[],
  path?: string[]
): Array<{ name: string; position?: string; url: string }> {
  const fromSlots = (slots || [])
    .filter((s) => !s.faceDown && s.card)
    .sort((a, b) => (a.revealOrder || 0) - (b.revealOrder || 0))
    .map((s) => {
      const url = findCardImageUrl(String(s.card))
      return url ? { name: String(s.card), position: s.position, url } : null
    })
    .filter(Boolean) as Array<{ name: string; position?: string; url: string }>

  if (fromSlots.length) return fromSlots.slice(0, 8)

  return (path || [])
    .map((name) => {
      const url = findCardImageUrl(name)
      return url ? { name, url } : null
    })
    .filter(Boolean)
    .slice(0, 8) as Array<{ name: string; position?: string; url: string }>
}

export async function sendDreamscapeClosingEmail(params: {
  userId: number
  sections: DreamscapeClosingSections
  petals?: Record<string, number>
  path?: string[]
  slots?: DreamscapeClosingSlot[]
  snapshot?: string | null
  summary?: string | null
}): Promise<{ sent: boolean; email?: string; error?: string }> {
  const user = await authMe(params.userId)
  const email = String(user?.email ?? '').trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return { sent: false, error: 'Adresse e-mail introuvable' }
  }

  const locale = (await resolveEmailLocale({ userId: params.userId })) as ServerLocale
  const title = tServer(locale, 'email.dreamscapeClosing.title')
  const subject = tServer(locale, 'email.dreamscapeClosing.subject')
  const badge = tServer(locale, 'email.dreamscapeClosing.badge')
  const subtitle = tServer(locale, 'email.dreamscapeClosing.subtitle')

  const inlineImages: EmailInlineAttachment[] = []
  let snapshotSrc: string | null = null
  if (params.snapshot) {
    const parsed = parseDataUrl(params.snapshot)
    if (parsed) {
      inlineImages.push({
        cid: SNAPSHOT_CID,
        filename: 'tirage-conversation.png',
        content: parsed.buffer,
        contentType: parsed.contentType || 'image/png',
      })
      snapshotSrc = `cid:${SNAPSHOT_CID}`
    }
  }

  const revealed = resolveRevealedCards(params.slots, params.path)
  const cardResolved = await Promise.all(
    revealed.map(async (c, i) => {
      const r = await fetchCardAsCid(c.url, i)
      if (r.attachment) inlineImages.push(r.attachment)
      return { name: c.name, position: c.position, src: r.src }
    })
  )

  const bodyHtml = buildDreamscapeClosingBodyHtml({
    sections: params.sections,
    locale,
    path: params.path,
    snapshotSrc,
    cardImages: cardResolved,
  })
  const text = buildDreamscapeClosingText(params.sections, locale, params.path)

  const hasPetals =
    params.petals && Object.values(params.petals).some((v) => Number(v) > 0.02)
  const heroInput: import('./email-layout').FleurEmailHero = hasPetals
    ? {
        type: 'flower',
        scores: params.petals!,
        caption: tServer(locale, 'email.dreamscapeClosing.flowerCaption'),
      }
    : { type: 'logo' }

  const resolved = await resolveHeroInlineAttachments(heroInput)
  inlineImages.push(...resolved.attachments)

  const layout = buildFleurEmailLayout({
    locale,
    preheader: (params.summary || params.sections.ce_qui_a_emerge || title).slice(0, 120),
    mode: 'user',
    title,
    subtitle,
    badge,
    hero: resolved.hero,
    journeyChips: [badge, subtitle],
    bodyHtml,
    cta: {
      label: tServer(locale, 'email.dreamscapeClosing.cta'),
      url: '/dreamscape/historique',
    },
  })

  const result = await sendTransactionalEmail({
    to: email,
    subject,
    html: layout.html,
    text: layout.text || text,
    userId: params.userId,
    skipPrefs: true,
    inlineImages: inlineImages.length ? inlineImages : undefined,
  })

  return { sent: result.sent, email, error: result.error }
}
