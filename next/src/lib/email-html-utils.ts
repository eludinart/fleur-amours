/** Extrait un aperçu texte depuis du HTML d'e-mail (notifications in-app). */
export function htmlToPlainText(html: string, maxLen = 400): string {
  let t = String(html ?? '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
  if (maxLen > 0 && t.length > maxLen) {
    t = `${t.slice(0, Math.max(0, maxLen - 1)).trim()}…`
  }
  return t
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Pré-en-tête invisible pour l'aperçu dans Gmail / Outlook (ne s'affiche pas dans le corps). */
export function injectEmailPreheader(html: string, preheader?: string | null): string {
  const text = String(preheader ?? '').trim()
  if (!text) return html
  const hidden = `<div style="display:none!important;max-height:0;overflow:hidden;opacity:0;color:transparent;line-height:0;font-size:0">${escapeHtml(text)}</div>`
  if (/<body[\s>]/i.test(html)) {
    return html.replace(/<body([^>]*)>/i, `<body$1>${hidden}`)
  }
  return hidden + html
}
