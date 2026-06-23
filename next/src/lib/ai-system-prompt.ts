/**
 * Construction des prompts système — noyau Fleur court, corpus Manuel (premium).
 */
import type { AiTaskId } from './ai-task-registry'
import { getAiTask } from './ai-task-registry'
import { appendManuelReferenceToSystem } from './manuel-ai-corpus'

/** Noyau court Fleur d'AmOurs — routes markdown/raw du jardin uniquement. */
export const FLEUR_CORE_SYSTEM_PROMPT = `Tu opères dans le Jardin Fleur d'AmOurs — espace symbolique de relation à soi et aux autres (8 pétales : agapè, philautia, mania, storgè, pragma, philia, ludus, éros).

Principes :
- Maïeutique : une question ouverte plutôt qu'un conseil prescriptif.
- Langage chaleureux, concret, sobre — pas de jargon ésotérique ni de diagnostic clinique.
- Pas de prédiction ni de divination : métaphores du jardin et symbolismes relationnels.
- Respecter la langue demandée par l'utilisateur.`

export type BuildSystemPromptInput = {
  taskId: AiTaskId
  basePrompt: string
  locale?: string
  /** Requête pour le corpus Manuel (premium uniquement). */
  manuelQuery?: string
  manuelMaxChars?: number
}

/** Assemble le prompt système selon le registre de tâche. */
export async function buildSystemPrompt(input: BuildSystemPromptInput): Promise<string> {
  const task = getAiTask(input.taskId)
  let system = input.basePrompt.trim()

  if (task.domain === 'fleur' && task.outputMode !== 'json') {
    system = `${FLEUR_CORE_SYSTEM_PROMPT}\n\n${system}`
  }

  if (task.tier === 'premium' && input.manuelQuery?.trim()) {
    system = appendManuelReferenceToSystem(system, {
      retrievalQuery: input.manuelQuery,
      maxChars: input.manuelMaxChars ?? 10_000,
      locale: input.locale,
    })
  }

  return system
}
