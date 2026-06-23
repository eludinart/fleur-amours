/**
 * E-mail d'invitation Duo / À deux — mise en page soignée avec fleur de l'inviteur.
 */
import { PETAL_DEFS, PETAL_BY_ID } from './petal-theme'
import {
  buildEmailFlowerSvg,
  dominantPetalFromScores,
  normalizePetalsForEmail,
} from './email-flower-svg'

const APP_NAME = "Fleur d'AmOurs"

const PORTE_LABELS: Record<string, string> = {
  love: 'Amour',
  vegetal: 'Végétal',
  elements: 'Éléments',
  life: 'Vie',
}

export type DuoInviteEmailKind = 'a_deux_porte' | 'a_deux_complet' | 'duo_classic' | 'couple_garden'

export type DuoInviteEmailContentParams = {
  inviterName: string
  inviterDisplayName?: string | null
  inviteUrl: string
  scores: Record<string, number>
  kind: DuoInviteEmailKind
  porteKey?: string | null
  ctaLabel?: string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function procedureSteps(kind: DuoInviteEmailKind): Array<{ emoji: string; title: string; desc: string }> {
  if (kind === 'couple_garden') {
    return [
      {
        emoji: '🌸',
        title: 'Découvrez la fleur de votre invitant·e',
        desc: 'Chaque pétale représente une dimension de l’amour — Agapè, Éros, Philia… La leur est déjà dessinée ci-dessus.',
      },
      {
        emoji: '🤝',
        title: 'Acceptez l’invitation',
        desc: 'Rejoignez le jardin commun : un espace privé à deux, sans questionnaire obligatoire pour commencer.',
      },
      {
        emoji: '💫',
        title: 'Cultivez votre lien au quotidien',
        desc: 'Messages partagés, rituels, fleur de duo et médiation guidée pour accompagner votre relation dans la durée.',
      },
    ]
  }

  const isPorte = kind === 'a_deux_porte'
  const isComplet = kind === 'a_deux_complet'
  const questionHint = isPorte
    ? '12 questions symboliques · environ 5 minutes'
    : isComplet
      ? '24 questions · environ 15 minutes'
      : '24 questions · environ 15 minutes'

  return [
    {
      emoji: '🌸',
      title: 'Découvrez la fleur de votre invitant·e',
      desc: 'Chaque pétale représente une dimension de l’amour — Agapè, Éros, Philia… La leur est déjà dessinée ci-dessus.',
    },
    {
      emoji: '✨',
      title: 'Répondez à votre tour',
      desc: `${questionHint}. Pas de bonne réponse : seulement votre ressenti du moment.`,
    },
    {
      emoji: '💫',
      title: 'Une fleur à deux apparaît',
      desc: 'Vos deux profils se superposent pour révéler vos points d’accord, vos écarts et la dynamique de votre lien.',
    },
  ]
}

function kindMeta(kind: DuoInviteEmailKind, porteKey?: string | null): { badge: string; duration: string } {
  if (kind === 'couple_garden') {
    return { badge: 'Jardin du duo', duration: 'Espace partagé' }
  }
  if (kind === 'a_deux_porte') {
    const porte = porteKey ? PORTE_LABELS[porteKey] ?? porteKey : 'Porte'
    return { badge: `À deux · Par une Porte — ${porte}`, duration: '~5 min' }
  }
  if (kind === 'a_deux_complet') {
    return { badge: 'À deux · Questionnaire complet', duration: '~15 min' }
  }
  return { badge: 'Fleur DUO', duration: '~15 min' }
}

function emailHeading(kind: DuoInviteEmailKind): { title: string; introLine: string } {
  if (kind === 'couple_garden') {
    return {
      title: 'Une invitation au Jardin du duo',
      introLine: 'vous invite à cultiver votre relation à deux dans un espace partagé et continu.',
    }
  }
  return {
    title: 'Une invitation à explorer à deux',
    introLine: 'a cartographié sa Fleur d\'AmOurs<br/>et vous invite à compléter la vôtre.',
  }
}

function buildPetalLegendHtml(scores: Record<string, number>): string {
  const normalized = normalizePetalsForEmail(scores)
  const rows = PETAL_DEFS.map((def) => {
    const v = normalized[def.id] ?? 0
    const pct = Math.round(v * 100)
    return (
      `<tr>` +
      `<td style="padding:4px 8px 4px 0;font-size:12px;color:#475569;white-space:nowrap">${escapeHtml(def.name)}</td>` +
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

export function buildDuoInviteEmailContent(params: DuoInviteEmailContentParams): { html: string; text: string; subject: string } {
  const inviter = params.inviterName.trim() || "Quelqu'un"
  const display = params.inviterDisplayName?.trim() || inviter
  const meta = kindMeta(params.kind, params.porteKey)
  const dominant = dominantPetalFromScores(params.scores)
  const flowerSvg = buildEmailFlowerSvg(params.scores, 240)
  const cta =
    params.ctaLabel ??
    (params.kind === 'couple_garden' ? 'Rejoindre le Jardin du duo' : 'Commencer mon questionnaire')
  const steps = procedureSteps(params.kind)
  const heading = emailHeading(params.kind)

  const subject =
    params.kind === 'duo_classic'
      ? `${inviter} vous invite à un questionnaire Duo sur ${APP_NAME} 🌸`
      : params.kind === 'couple_garden'
        ? `${inviter} vous invite au Jardin du duo sur ${APP_NAME} 🌸`
        : `${inviter} vous invite à un parcours À deux sur ${APP_NAME} 🌸`

  const stepsHtml = steps
    .map(
      (s, i) =>
        `<tr><td style="padding:0 0 16px 0">` +
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fafafa;border-radius:16px;border:1px solid #e2e8f0">` +
        `<tr><td style="padding:16px 18px">` +
        `<p style="margin:0 0 4px;font-size:13px;color:#7c3aed;font-weight:700">Étape ${i + 1}</p>` +
        `<p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#1e293b">${s.emoji} ${escapeHtml(s.title)}</p>` +
        `<p style="margin:0;font-size:14px;line-height:1.55;color:#64748b">${escapeHtml(s.desc)}</p>` +
        `</td></tr></table></td></tr>`
    )
    .join('')

  const dominantLine = dominant
    ? `Pétale le plus déployé : <strong style="color:${PETAL_BY_ID[dominant.id]?.color ?? '#7c3aed'}">${escapeHtml(dominant.name)}</strong>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f0ff;font-family:Georgia,'Times New Roman',serif;color:#1e293b">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:linear-gradient(180deg,#f4f0ff 0%,#fdf2f8 45%,#f8fafc 100%);padding:32px 16px">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 8px 40px rgba(124,58,237,0.12)">
          <!-- En-tête -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed 0%,#db2777 55%,#ec8698 100%);padding:28px 28px 24px;text-align:center">
              <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.85);font-family:system-ui,sans-serif">${APP_NAME}</p>
              <h1 style="margin:0;font-size:24px;line-height:1.35;color:#ffffff;font-weight:700">${escapeHtml(heading.title)}</h1>
              <p style="margin:12px 0 0;font-size:15px;line-height:1.5;color:rgba(255,255,255,0.92)">
                <strong>${escapeHtml(display)}</strong> ${heading.introLine}
              </p>
              <p style="margin:14px 0 0;display:inline-block;background:rgba(255,255,255,0.2);color:#fff;font-size:12px;font-family:system-ui,sans-serif;padding:6px 14px;border-radius:999px;font-weight:600">
                ${escapeHtml(meta.badge)} · ${escapeHtml(meta.duration)}
              </p>
            </td>
          </tr>

          <!-- Fleur -->
          <tr>
            <td style="padding:28px 28px 8px;text-align:center">
              <p style="margin:0 0 12px;font-size:13px;font-family:system-ui,sans-serif;color:#7c3aed;font-weight:600;letter-spacing:0.04em;text-transform:uppercase">La fleur de ${escapeHtml(display)}</p>
              <div style="display:inline-block;background:radial-gradient(circle at 50% 55%,#fff5f7 0%,#ffffff 70%);border-radius:50%;padding:8px;line-height:0">
                ${flowerSvg}
              </div>
              ${dominantLine ? `<p style="margin:14px 0 0;font-size:14px;color:#64748b;font-family:system-ui,sans-serif">${dominantLine}</p>` : ''}
              ${buildPetalLegendHtml(params.scores)}
            </td>
          </tr>

          <!-- Méthode -->
          <tr>
            <td style="padding:20px 28px 8px">
              <h2 style="margin:0 0 16px;font-size:18px;color:#1e293b;font-family:system-ui,sans-serif">Comment ça marche ?</h2>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                ${stepsHtml}
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:8px 28px 32px;text-align:center">
              <a href="${escapeHtml(params.inviteUrl)}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#db2777);color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:16px;font-size:16px;font-weight:700;font-family:system-ui,sans-serif;box-shadow:0 4px 20px rgba(124,58,237,0.35)">
                ${escapeHtml(cta)} →
              </a>
              <p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#94a3b8;font-family:system-ui,sans-serif">
                Si le bouton ne s'ouvre pas, copiez ce lien dans votre navigateur :<br/>
                <a href="${escapeHtml(params.inviteUrl)}" style="color:#7c3aed;word-break:break-all">${escapeHtml(params.inviteUrl)}</a>
              </p>
            </td>
          </tr>

          <!-- Pied -->
          <tr>
            <td style="padding:20px 28px;background:#f8fafc;border-top:1px solid #e2e8f0">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;font-family:system-ui,sans-serif;text-align:center">
                Les 8 pétales de la Fleur d'AmOurs explorent huit façons d'aimer — pas un diagnostic, mais une carte pour mieux se comprendre ensemble.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const textIntro =
    params.kind === 'couple_garden'
      ? `${display} vous invite au Jardin du duo — un espace partagé pour cultiver votre relation à deux.`
      : `${display} vous invite à compléter votre Fleur d'AmOurs.`

  const text = [
    `${APP_NAME} — Invitation à deux`,
    '',
    textIntro,
    meta.badge,
    dominant ? `Pétale dominant : ${dominant.name}` : '',
    '',
    'Comment ça marche :',
    ...steps.map((s, i) => `${i + 1}. ${s.title} — ${s.desc}`),
    '',
    `${cta} : ${params.inviteUrl}`,
  ]
    .filter(Boolean)
    .join('\n')

  return { html, text, subject }
}
