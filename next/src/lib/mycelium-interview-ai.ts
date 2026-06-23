/**
 * IA entretien bien-être Mycelium — posture prévention RPS / QVT.
 */
import { llmCallForTask, getLlmMetaForTask, isLlmConfigured } from './llm'
import { getLangInstruction } from './prompts'
import {
  getInterviewTopic,
  MYCELIUM_INTERVIEW_MAX_TURNS,
  type MyceliumInterviewTopic,
} from './mycelium-interview-topics'
import type { InterviewMessage } from './db-mycelium-interviews'

export type InterviewAiTurn = {
  acknowledgment: string
  question: string | null
  proposeClose: boolean
  closureMessage: string | null
  suggestedMood: number | null
  employeeSummary: string | null
  pulseNote: string | null
  dimensions: string[]
  turn: number
  maxTurns: number
  provider: string
}

function clampMood(v: unknown): number | null {
  const n = parseInt(String(v), 10)
  if (!Number.isFinite(n)) return null
  return Math.min(5, Math.max(1, n))
}

function buildSystemPrompt(topic: MyceliumInterviewTopic, locale: string, orgName: string): string {
  return (
    'Tu es un facilitateur bien-être en entreprise (QVT, prévention des risques psychosociaux). ' +
    'Tu mènes un ENTRETIEN CONFIDENTIEL avec un(e) salarié(e) — ton calme, professionnel, chaleureux. ' +
    'Tu N\'ES PAS thérapeute : pas de diagnostic, pas de conseil médical, pas de jugement, pas de menace disciplinaire. ' +
    'Tu pratiques l\'écoute active : reformulation brève, une seule question ouverte à la fois. ' +
    'Thématique : ' +
    topic.labelFr +
    '. Dimensions RH associées : ' +
    topic.dimensions.join(', ') +
    '. Organisation : ' +
    orgName +
    '. ' +
    'Réponds UNIQUEMENT en JSON : ' +
    '{"acknowledgment":"...","question":"... ou null","propose_close":false,"closure_message":null,' +
    '"suggested_mood":3,"employee_summary":null,"pulse_note":null,"dimensions":["..."]}. ' +
    'acknowledgment : 1-2 phrases miroir (max 280 car.). ' +
    'question : UNE question ouverte bienveillante, ou null si propose_close. ' +
    'propose_close : true au dernier tour ou si le salarié a suffisamment exprimé (max ' +
    MYCELIUM_INTERVIEW_MAX_TURNS +
    ' tours). ' +
    'closure_message : message de clôture si propose_close (remerciement + rappel confidentialité agrégats). ' +
    'suggested_mood : entier 1-5 estimé à partir de l\'échange. ' +
    'employee_summary : si propose_close, synthèse personnelle 2-3 phrases pour le salarié. ' +
    'pulse_note : si propose_close, phrase courte anonymisable pour le pulse collectif (sans nom, sans détail identifiant). ' +
    'dimensions : sous-ensemble des dimensions thématiques pertinentes. ' +
    getLangInstruction(locale)
  )
}

function fallbackTurn(
  topic: MyceliumInterviewTopic,
  userTurnCount: number,
  lastUserMessage: string
): InterviewAiTurn {
  const maxTurns = MYCELIUM_INTERVIEW_MAX_TURNS
  const turn = userTurnCount + 1
  const proposeClose = turn >= maxTurns
  const qIdx = Math.min(userTurnCount, topic.fallbackQuestions.length - 1)
  const acknowledgment =
    lastUserMessage.length > 10
      ? 'Merci pour ce que vous partagez — je prends note de ce ressenti.'
      : topic.introFr

  if (proposeClose) {
    return {
      acknowledgment,
      question: null,
      proposeClose: true,
      closureMessage:
        'Merci pour cet échange. Votre parole compte : seuls des indicateurs anonymes et agrégés peuvent alimenter le tableau de bord RH. Vous pouvez maintenant valider votre humeur et enregistrer votre pulse.',
      suggestedMood: 3,
      employeeSummary: 'Vous avez exploré la thématique « ' + topic.labelFr + ' » et identifié des éléments importants pour votre bien-être au travail.',
      pulseNote: 'Échange bien-être : ' + topic.labelFr.toLowerCase(),
      dimensions: topic.dimensions,
      turn,
      maxTurns,
      provider: 'fallback',
    }
  }

  return {
    acknowledgment,
    question: topic.fallbackQuestions[qIdx],
    proposeClose: false,
    closureMessage: null,
    suggestedMood: null,
    employeeSummary: null,
    pulseNote: null,
    dimensions: topic.dimensions,
    turn,
    maxTurns,
    provider: 'fallback',
  }
}

export async function generateInterviewTurn(params: {
  topicSlug: string
  orgName: string
  locale: string
  messages: InterviewMessage[]
  userMessage: string
}): Promise<InterviewAiTurn> {
  const topic = getInterviewTopic(params.topicSlug)
  if (!topic) throw new Error('Thématique inconnue')

  const userTurnCount = params.messages.filter((m) => m.role === 'user').length
  const turn = userTurnCount + 1
  const maxTurns = MYCELIUM_INTERVIEW_MAX_TURNS

  if (!(await isLlmConfigured())) {
    return fallbackTurn(topic, userTurnCount, params.userMessage)
  }

  const history = params.messages.slice(-10).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const userPayload =
    `[Tour ${turn}/${maxTurns}] Thématique: ${topic.labelFr}\n` +
    `Message du salarié:\n${params.userMessage}`

  const result = await llmCallForTask('mycelium-interview',
    buildSystemPrompt(topic, params.locale, params.orgName),
    [...history, { role: 'user', content: userPayload }],
    { responseFormatJson: true, maxTokens: 650, timeoutMs: 28000 }
  )

  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return fallbackTurn(topic, userTurnCount, params.userMessage)
  }

  const r = result as Record<string, unknown>
  const proposeClose = !!r.propose_close || turn >= maxTurns
  return {
    acknowledgment: String(r.acknowledgment ?? 'Merci pour votre retour.').slice(0, 400),
    question: proposeClose ? null : String(r.question ?? topic.fallbackQuestions[0] ?? '').slice(0, 400) || null,
    proposeClose,
    closureMessage: r.closure_message != null ? String(r.closure_message).slice(0, 500) : null,
    suggestedMood: clampMood(r.suggested_mood),
    employeeSummary: r.employee_summary != null ? String(r.employee_summary).slice(0, 600) : null,
    pulseNote: r.pulse_note != null ? String(r.pulse_note).slice(0, 400) : null,
    dimensions: Array.isArray(r.dimensions)
      ? r.dimensions.map((d) => String(d).slice(0, 80)).filter(Boolean).slice(0, 4)
      : topic.dimensions,
    turn,
    maxTurns,
    provider: (await getLlmMetaForTask('mycelium-interview')).provider,
  }
}

export function buildOpeningTurn(topic: MyceliumInterviewTopic): InterviewAiTurn {
  return {
    acknowledgment: topic.introFr,
    question: topic.fallbackQuestions[0] ?? 'Comment vous sentez-vous au travail en ce moment ?',
    proposeClose: false,
    closureMessage: null,
    suggestedMood: null,
    employeeSummary: null,
    pulseNote: null,
    dimensions: topic.dimensions,
    turn: 0,
    maxTurns: MYCELIUM_INTERVIEW_MAX_TURNS,
    provider: 'template',
  }
}
