/**
 * Coquille HTML unique pour tous les e-mails Fleur d'AmOurs (tables, i18n, CTA).
 */
import { absolutePublicAppUrl, CANONICAL_JARDIN_ORIGIN, withPublicBasePath } from './app-public-url'
import { buildEmailFlowerSvg, dominantPetalFromScores } from './email-flower-svg'
import { injectEmailPreheader } from './email-html-utils'
import { tServer, type ServerLocale } from './i18n-server'
import { PETAL_BY_ID } from './petal-theme'

const LOGO_SIZE = 80
const FLOWER_SIZE = 200
const MAX_BODY_IMAGE_HEIGHT = 280

export type FleurEmailMode = 'user' | 'admin' | 'marketing'

export type FleurEmailHero =
  | { type: 'none' }
  | { type: 'logo' }
  | { type: 'flower'; scores: Record<string, number>; caption?: string }
  | { type: 'image'; src: string; alt: string; width?: number }

export type FleurEmailLayoutParams = {
  locale?: string
  preheader?: string | null
  mode?: FleurEmailMode
  title: string
  subtitle?: string | null
  badge?: string | null
  hero?: FleurEmailHero
  /** Puces parcours (ex. « Ma Fleur ✓ · Jour 3/14 ») */
  journeyChips?: string[]
  body?: string | null
  bodyHtml?: string | null
  highlight?: string | null
  extraHtml?: string | null
  cta?: { label: string; url: string } | null
}

export function escapeEmailHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function absUrl(path: string): string {
  if (!path || path.startsWith('http')) return path
  return absolutePublicAppUrl(path)
}

/** URL d'image dans un e-mail : jamais localhost (inaccessible depuis le client mail). */
function emailAssetUrl(path: string): string {
  const url = absolutePublicAppUrl(path)
  if (/localhost|127\.0\.0\.1|^http:\/\//i.test(url)) {
    return `${CANONICAL_JARDIN_ORIGIN}${withPublicBasePath(path)}`
  }
  return url
}

function logoUrl(): string {
  return emailAssetUrl('/juste-la-fleur.png')
}

function bodyTextToHtml(body: string): string {
  return body
    .split(/\n\n+/)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;color:#334155;font-size:15px;line-height:1.65;font-family:Georgia,'Times New Roman',serif">${escapeEmailHtml(p).replace(/\n/g, '<br>')}</p>`
    )
    .join('')
}

function buildHeroBlock(hero: FleurEmailHero, locale: ServerLocale): string {
  if (hero.type === 'none') return ''
  if (hero.type === 'logo') {
    const src = logoUrl()
    return (
      `<tr><td style="padding:24px 28px 8px;text-align:center">` +
      `<img src="${escapeEmailHtml(src)}" alt="${escapeEmailHtml(tServer(locale, 'email.shell.appName'))}" width="${LOGO_SIZE}" height="${LOGO_SIZE}" style="display:block;margin:0 auto;width:${LOGO_SIZE}px;height:${LOGO_SIZE}px;object-fit:contain"/>` +
      `</td></tr>`
    )
  }
  if (hero.type === 'image') {
    const w = hero.width ?? 560
    return (
      `<tr><td style="padding:20px 28px 8px;text-align:center">` +
      `<img src="${escapeEmailHtml(hero.src)}" alt="${escapeEmailHtml(hero.alt)}" width="${w}" style="display:block;margin:0 auto;max-width:100%;width:100%;height:auto;max-height:${MAX_BODY_IMAGE_HEIGHT}px;object-fit:contain;border-radius:12px"/>` +
      `</td></tr>`
    )
  }
  if (hero.type === 'flower') {
    const flowerSvg = buildEmailFlowerSvg(hero.scores, FLOWER_SIZE)
    const dominant = dominantPetalFromScores(hero.scores)
    const caption = hero.caption ?? tServer(locale, 'email.journey.yourFlowerToday')
    const petalColor = dominant ? PETAL_BY_ID[dominant.id]?.color ?? '#7c3aed' : '#7c3aed'
    const dominantLine = dominant
      ? `<p style="margin:14px 0 0;font-size:14px;line-height:1.5;color:#64748b;font-family:system-ui,-apple-system,sans-serif">${escapeEmailHtml(tServer(locale, 'email.journey.dominantPetalPrefix'))} <strong style="color:${petalColor}">${escapeEmailHtml(dominant.name)}</strong></p>`
      : ''
    const logoFallback = logoUrl()
    return (
      `<tr><td style="padding:24px 28px 8px;text-align:center">` +
      `<p style="margin:0 0 12px;font-size:12px;font-family:system-ui,-apple-system,sans-serif;color:#7c3aed;font-weight:600;letter-spacing:0.06em;text-transform:uppercase">${escapeEmailHtml(caption)}</p>` +
      `<!--[if mso]><img src="${escapeEmailHtml(logoFallback)}" alt="" width="${FLOWER_SIZE}" height="${FLOWER_SIZE}" style="display:block;margin:0 auto;width:${FLOWER_SIZE}px;height:${FLOWER_SIZE}px"/><![endif]-->` +
      `<!--[if !mso]><!-->` +
      `<div style="display:inline-block;background:radial-gradient(circle at 50% 55%,#fff5f7 0%,#ffffff 72%);border-radius:50%;padding:8px;line-height:0">${flowerSvg}</div>` +
      `<!--<![endif]-->` +
      dominantLine +
      `</td></tr>`
    )
  }
  return ''
}

function buildJourneyChips(chips: string[]): string {
  if (!chips.length) return ''
  const items = chips
    .map(
      (c) =>
        `<span style="display:inline-block;margin:4px 6px 4px 0;padding:5px 12px;background:#f5f3ff;border:1px solid #e9e5ff;border-radius:999px;font-size:12px;color:#5b21b6;font-family:system-ui,-apple-system,sans-serif;font-weight:500">${escapeEmailHtml(c)}</span>`
    )
    .join('')
  return (
    `<tr><td style="padding:4px 28px 16px;text-align:center">` +
    `<div style="line-height:1.8">${items}</div>` +
    `</td></tr>`
  )
}

function buildCtaBlock(cta: { label: string; url: string }, locale: ServerLocale): string {
  const url = absUrl(cta.url)
  return (
    `<tr><td style="padding:8px 28px 28px;text-align:center">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto">` +
    `<tr><td style="border-radius:16px;background:linear-gradient(135deg,#7c3aed,#db2777)">` +
    `<a href="${escapeEmailHtml(url)}" style="display:inline-block;padding:16px 32px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;font-family:system-ui,-apple-system,sans-serif;min-width:200px;text-align:center">${escapeEmailHtml(cta.label)} →</a>` +
    `</td></tr></table>` +
    `<p style="margin:18px 28px 0;font-size:12px;line-height:1.55;color:#94a3b8;font-family:system-ui,-apple-system,sans-serif">` +
    `${escapeEmailHtml(tServer(locale, 'email.shell.ctaFallback'))}<br/>` +
    `<a href="${escapeEmailHtml(url)}" style="color:#7c3aed;word-break:break-all">${escapeEmailHtml(url)}</a>` +
    `</p>` +
    `</td></tr>`
  )
}

function buildFooter(locale: ServerLocale, mode: FleurEmailMode): string {
  const prefsUrl = absUrl('/notifications/preferences')
  const appName = tServer(locale, 'email.shell.appName')
  const footerText = tServer(locale, 'email.shell.footer')
  const prefsLabel = tServer(locale, 'email.shell.prefsLink')
  const adminNote =
    mode === 'admin' ? tServer(locale, 'email.shell.adminFooter') : ''

  return (
    `<tr><td style="padding:20px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center">` +
    `<p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#94a3b8;font-family:system-ui,-apple-system,sans-serif">${escapeEmailHtml(footerText)}</p>` +
    (mode !== 'admin'
      ? `<p style="margin:0;font-size:12px;font-family:system-ui,-apple-system,sans-serif"><a href="${escapeEmailHtml(prefsUrl)}" style="color:#7c3aed;text-decoration:underline">${escapeEmailHtml(prefsLabel)}</a></p>`
      : '') +
    (adminNote
      ? `<p style="margin:10px 0 0;font-size:11px;color:#cbd5e1;font-family:system-ui,-apple-system,sans-serif">${escapeEmailHtml(adminNote)}</p>`
      : '') +
  `<p style="margin:12px 0 0;font-size:11px;color:#cbd5e1;font-family:system-ui,-apple-system,sans-serif">${escapeEmailHtml(appName)}</p>` +
    `</td></tr>`
  )
}

/** Enveloppe le corps HTML libre (broadcast Unlayer) dans la coquille. */
export function wrapBroadcastEmailHtml(params: {
  locale?: string
  preheader?: string | null
  title: string
  bodyHtml: string
  cta?: { label: string; url: string } | null
}): { html: string; text: string } {
  return buildFleurEmailLayout({
    locale: params.locale,
    preheader: params.preheader,
    mode: 'marketing',
    title: params.title,
    hero: { type: 'logo' },
    bodyHtml: params.bodyHtml,
    cta: params.cta ?? null,
  })
}

export function buildFleurEmailLayout(params: FleurEmailLayoutParams): { html: string; text: string } {
  const locale = (params.locale ?? 'fr') as ServerLocale
  const mode = params.mode ?? 'user'
  const title = String(params.title ?? '').trim()
  const subtitle = params.subtitle ? String(params.subtitle).trim() : ''
  const badge = params.badge ? String(params.badge).trim() : ''
  const body = params.body ? String(params.body).trim() : ''
  const highlight = params.highlight ? String(params.highlight).trim() : ''
  const showHero = mode !== 'admin' && params.hero && params.hero.type !== 'none'
  const hero: FleurEmailHero =
    mode === 'admin' ? { type: 'none' } : (params.hero ?? { type: 'logo' })
  const cta = mode === 'admin' ? null : params.cta ?? null

  const bodyInner = params.bodyHtml
    ? `<div style="font-size:15px;line-height:1.65;color:#334155;font-family:Georgia,'Times New Roman',serif">${params.bodyHtml}</div>`
    : bodyTextToHtml(body)

  const highlightHtml = highlight
    ? `<div style="margin:18px 0;padding:14px 18px;background:#f5f3ff;border-left:4px solid #7c3aed;border-radius:10px;font-size:15px;line-height:1.55;color:#4c1d95;font-family:Georgia,'Times New Roman',serif">${escapeEmailHtml(highlight)}</div>`
    : ''

  const appName = tServer(locale, 'email.shell.appName')

  const htmlCore = `<!DOCTYPE html>
<html lang="${escapeEmailHtml(locale)}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="color-scheme" content="light only"/>
  <title>${escapeEmailHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f0ff;font-family:Georgia,'Times New Roman',serif;color:#1e293b">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:linear-gradient(180deg,#f4f0ff 0%,#fdf2f8 48%,#f8fafc 100%);padding:28px 16px">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 6px 32px rgba(124,58,237,0.1)">
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed 0%,#db2777 55%,#ec8698 100%);padding:26px 28px 22px;text-align:center">
              <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.88);font-family:system-ui,-apple-system,sans-serif">${escapeEmailHtml(appName)}</p>
              <h1 style="margin:0;font-size:22px;line-height:1.35;color:#ffffff;font-weight:700">${escapeEmailHtml(title)}</h1>
              ${subtitle ? `<p style="margin:10px 0 0;font-size:15px;line-height:1.5;color:rgba(255,255,255,0.92)">${subtitle}</p>` : ''}
              ${badge ? `<p style="margin:12px 0 0;display:inline-block;background:rgba(255,255,255,0.2);color:#fff;font-size:12px;font-family:system-ui,-apple-system,sans-serif;padding:6px 14px;border-radius:999px;font-weight:600">${escapeEmailHtml(badge)}</p>` : ''}
            </td>
          </tr>
          ${showHero ? buildHeroBlock(hero, locale) : ''}
          ${params.journeyChips?.length ? buildJourneyChips(params.journeyChips) : ''}
          <tr>
            <td style="padding:20px 28px 8px">
              ${bodyInner}
              ${highlightHtml}
              ${params.extraHtml ?? ''}
            </td>
          </tr>
          ${cta ? buildCtaBlock(cta, locale) : ''}
          ${buildFooter(locale, mode)}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const html = injectEmailPreheader(htmlCore, params.preheader ?? highlight ?? body.slice(0, 120))

  const textParts = [title, subtitle, body, highlight]
  if (params.journeyChips?.length) textParts.push(params.journeyChips.join(' · '))
  if (cta) textParts.push(`${cta.label} : ${absUrl(cta.url)}`)
  const text = textParts.filter(Boolean).join('\n\n')

  return { html, text }
}
