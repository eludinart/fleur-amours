/**
 * Pièces jointes inline (CID) pour images dans les e-mails transactionnels.
 */
import { readFile } from 'fs/promises'
import { join } from 'path'
import { renderEmailFlowerPng, EMAIL_FLOWER_DISPLAY_SIZE } from './email-flower-png'
import type { FleurEmailHero } from './email-layout'

export const EMAIL_FLOWER_CID = 'fleur-hero@fleurdamours'
export const EMAIL_LOGO_CID = 'fleur-logo@fleurdamours'

export type EmailInlineAttachment = {
  cid: string
  filename: string
  content: Buffer
  contentType: string
}

let logoBufferCache: Buffer | null = null

export async function readEmailLogoBuffer(): Promise<Buffer> {
  if (!logoBufferCache) {
    logoBufferCache = await readFile(join(process.cwd(), 'public', 'juste-la-fleur.png'))
  }
  return logoBufferCache
}

export async function buildFlowerInlineAttachment(
  scores: Record<string, number>
): Promise<EmailInlineAttachment> {
  return {
    cid: EMAIL_FLOWER_CID,
    filename: 'fleur-personnalisee.png',
    content: await renderEmailFlowerPng(scores),
    contentType: 'image/png',
  }
}

export async function buildLogoInlineAttachment(): Promise<EmailInlineAttachment> {
  return {
    cid: EMAIL_LOGO_CID,
    filename: 'juste-la-fleur.png',
    content: await readEmailLogoBuffer(),
    contentType: 'image/png',
  }
}

/** Prépare le héros + pièces jointes CID (fleur ou logo). */
export async function resolveHeroInlineAttachments(
  hero: FleurEmailHero
): Promise<{ hero: FleurEmailHero; attachments: EmailInlineAttachment[] }> {
  if (hero.type === 'flower') {
    const attachment = await buildFlowerInlineAttachment(hero.scores)
    return {
      hero: { ...hero, cid: EMAIL_FLOWER_CID },
      attachments: [attachment],
    }
  }
  if (hero.type === 'logo') {
    const attachment = await buildLogoInlineAttachment()
    return {
      hero: { type: 'logo', cid: EMAIL_LOGO_CID },
      attachments: [attachment],
    }
  }
  return { hero, attachments: [] }
}

/** Remplace les CID par des data-URI pour l'aperçu navigateur (admin). */
export function embedInlineImagesForPreview(
  html: string,
  attachments: EmailInlineAttachment[]
): string {
  let out = html
  for (const att of attachments) {
    const dataUri = `data:${att.contentType};base64,${att.content.toString('base64')}`
    out = out.split(`cid:${att.cid}`).join(dataUri)
  }
  return out
}

export function emailFlowerImgTag(cid: string, size = EMAIL_FLOWER_DISPLAY_SIZE): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto">` +
    `<tr><td align="center" style="text-align:center;background:radial-gradient(circle at 50% 55%,#fff5f7 0%,#ffffff 72%);border-radius:50%;padding:14px;line-height:0">` +
    `<img src="cid:${cid}" alt="" width="${size}" height="${size}" border="0" ` +
    `style="display:block;width:${size}px;height:${size}px;max-width:${size}px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic"/>` +
    `</td></tr></table>`
  )
}
