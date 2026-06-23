/**
 * Lecture IA landing — carte + intention (invités, sans compte).
 */
import { createHash } from 'crypto'
import { getCardInfo } from './card-info'
import { FLEUR_CORE_SYSTEM_PROMPT, buildSystemPrompt } from './ai-system-prompt'
import { getLangInstruction } from './prompts'
import { isLlmConfigured, llmCallForTask } from './llm'
import { cacheGet, cacheSet } from './server-cache'

const CACHE_TTL_MS = 24 * 3600_000
/** Incrémenter pour invalider les lectures génériques mises en cache. */
const PROMPT_VERSION = 'v2'

export type LandingReadingResult = {
  mirror: string
  reading: string
  question: string
  provider?: string
  cached?: boolean
  fallback?: boolean
}

const LANDING_READING_BASE_PROMPT = `Tu es l'interprète du Tarot Fleur d'AmOurs — première rencontre sur la page d'accueil (visiteur sans compte).

EFFET ATTENDU : la personne doit se sentir comprise — pas un catalogue de carte, pas une phrase générique. Elle doit avoir envie d'aller plus loin dans le Jardin.

RÈGLES :
- Lis l'intention comme une problématique vécue (émotions, tensions, blocages). Reprends 1 à 2 mots ou images tirés de ses propres termes.
- Croise explicitement le nom de la carte avec SA situation — nomme le lien concret, ne te contente pas de décrire la carte.
- Jamais : divination, prédiction, diagnostic clinique, jargon « 8 pétales » ou science du deck.
- Jamais : recopier la « Lumière » ou la description deck ; inspire-toi-en pour une lecture sur-mesure.
- Ton : chaleureux, précis, sobre — comme un accompagnant attentif en 30 secondes de lecture.

FORMAT JSON strict (pas de markdown) :
{
  "mirror": "1 phrase — reformulation empathique de ce qu'elle porte (pas une citation entre guillemets)",
  "reading": "2 paragraphes courts séparés par \\n\\n — §1 : lien carte↔intention ; §2 : angle ou mouvement intérieur possible",
  "question": "1 question ouverte qui croise la carte ET son intention précise"
}

Si intention vide : accueillir la carte tirée et inviter à une résonance personnelle.

MAUVAIS (trop générique) : « Cette carte éclaire votre intention en nommant un mouvement intérieur… »
BON (ton visé) : intention « je n'arrive pas à dire je t'aime » + carte La Germination → mirror sur le blocage des mots ; reading lie le premier pas fragile aux mots coincés ; question cible un petit mouvement possible.`

function cacheKey(input: {
  cardName: string
  intention: string
  locale: string
}): string {
  return (
    `landing_reading:${PROMPT_VERSION}:` +
    createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex')
  )
}

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s']/g, ' ')
}

function extractSignificantWords(intention: string, max = 4): string[] {
  const stop = new Set([
    'comme', 'quand', 'alors', 'parce', 'cette', 'depuis', 'surtout', 'arrive',
    'completement', 'vraiment', 'encore', 'trop', 'peu', 'dans', 'avec', 'pour',
    'mais', 'plus', 'tout', 'tous', 'toute', 'faire', 'etre', 'avoir', 'quand',
    'when', 'that', 'this', 'with', 'from', 'have', 'been', 'really', 'just',
  ])
  return normalizeText(intention)
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !stop.has(w))
    .slice(0, max)
}

type IntentionBridge = {
  mirror: (words: string[]) => string
  bridge: string
  question: (cardName: string, words: string[]) => string
}

const INTENTION_BRIDGES: Record<string, Partial<Record<string, IntentionBridge>>> = {
  fr: {
    love_words: {
      mirror: () =>
        'Vous traversez une zone sensible autour des mots d\'amour — les dire ou les recevoir semble bloqué en ce moment.',
      bridge:
        'Ce n\'est pas un manque de sentiment : c\'est peut-être un mouvement intérieur qui n\'a pas encore trouvé sa forme — et cette carte parle justement de ce seuil fragile.',
      question: (card) =>
        `Quel tout petit pas — en deçà des grands mots — « ${card} » vous invite-t-elle à tenter dans vos relations ?`,
    },
    lost_relations: {
      mirror: () =>
        'Vous vous sentez un peu perdu(e) dans vos relations amoureuses — comme sans repère clair pour vous situer.',
      bridge:
        'La carte ne vous demande pas d\'avoir la carte du chemin : elle éclaire un mouvement modeste mais réel, là où quelque chose cherche encore à naître.',
      question: (card) =>
        `Où, dans votre vie affective, « ${card} » pourrait-elle nommer un premier pas plutôt qu'une grande réponse ?`,
    },
  },
  en: {
    love_words: {
      mirror: () =>
        'You are in a tender spot around the words of love — saying them or receiving them feels blocked right now.',
      bridge:
        'This is not a lack of feeling: something inner may not have found its form yet — and this card speaks of that fragile threshold.',
      question: (card) =>
        `What tiny step — beneath the big words — does « ${card} » invite you to try in your relationships?`,
    },
    lost_relations: {
      mirror: () =>
        'You feel somewhat lost in your romantic relationships — as if you lack a clear reference point.',
      bridge:
        'The card does not ask you to have the whole map: it lights a modest but real movement where something is still trying to be born.',
      question: (card) =>
        `Where in your love life could « ${card} » name a first step rather than a big answer?`,
    },
  },
}

function detectIntentionBridge(intention: string, locale: string): IntentionBridge | null {
  const loc = locale.toLowerCase().split('-')[0]
  const bridges = INTENTION_BRIDGES[loc] ?? INTENTION_BRIDGES.fr
  const norm = normalizeText(intention)
  if (/je t.aime|dire.*aime|entendre.*aime|say.*love|hear.*love|love you/.test(norm)) {
    return bridges.love_words ?? null
  }
  if (/perdu|perdue|lost|perdido|perso|verloren/.test(norm) && /relation|amour|love|amor|liebe/.test(norm)) {
    return bridges.lost_relations ?? null
  }
  return null
}

function buildFallback(
  cardName: string,
  intention: string,
  lumiere: string,
  rootQuestion: string,
  locale: string
): LandingReadingResult {
  const loc = locale.toLowerCase().split('-')[0]
  const trimmed = intention.trim().slice(0, 400)
  const words = extractSignificantWords(trimmed)
  const bridge = detectIntentionBridge(trimmed, loc)

  const mirror = bridge
    ? bridge.mirror(words)
    : trimmed
      ? loc === 'en'
        ? `Something alive in what you share: ${words.slice(0, 3).join(', ') || 'a question that matters to you'}.`
        : `Quelque chose de vivant dans ce que vous partagez : ${words.slice(0, 3).join(', ') || 'une question qui vous habite'}.`
      : loc === 'en'
        ? `« ${cardName} » appears for you.`
        : `« ${cardName} » se présente à vous.`

  const cardHook = lumiere.trim()
    ? lumiere.trim().split(/[.!?]/)[0]?.trim() + '.'
    : ''

  const personalizedBridge = bridge
    ? bridge.bridge
    : trimmed
      ? loc === 'en'
        ? `Around ${words.slice(0, 2).join(' and ') || 'what you named'}, « ${cardName} » does not explain you — it offers a precise angle on what you are living.`
        : `Autour de ${words.slice(0, 2).join(' et ') || 'ce que vous nommez'}, « ${cardName} » ne vous explique pas — elle propose un angle précis sur ce que vous traversez.`
      : loc === 'en'
        ? 'Let the essence of the card resonate before seeking a conclusion.'
        : "Laissez l'essence de la carte résonner avant de chercher une conclusion."

  const reading = [cardHook, personalizedBridge].filter(Boolean).join('\n\n')

  const question = bridge
    ? bridge.question(cardName, words)
    : rootQuestion.trim() ||
      (loc === 'en'
        ? 'What does this card stir in you, right now?'
        : 'Qu’est-ce que cette carte réveille en vous, là, maintenant ?')

  return { mirror, reading, question, fallback: true }
}

export async function generateLandingReading(input: {
  cardName: string
  essence?: string
  lumiere?: string
  rootQuestion?: string
  intention?: string
  locale?: string
}): Promise<LandingReadingResult> {
  const cardName = String(input.cardName ?? '').trim()
  if (!cardName) {
    return { mirror: '', reading: '', question: '' }
  }

  const intention = String(input.intention ?? '').trim().slice(0, 400)
  const locale = String(input.locale ?? 'fr').toLowerCase().slice(0, 5)
  const essence = String(input.essence ?? '').trim().slice(0, 400)
  const lumiere = String(input.lumiere ?? '').trim().slice(0, 600)
  const rootQuestion = String(input.rootQuestion ?? '').trim().slice(0, 300)

  const key = cacheKey({ cardName, intention, locale })
  const cached = cacheGet<LandingReadingResult>(key)
  if (cached?.reading && !cached.fallback) {
    return { ...cached, cached: true }
  }

  if (!(await isLlmConfigured())) {
    return buildFallback(cardName, intention, lumiere, rootQuestion, locale)
  }

  const info = await getCardInfo(cardName)
  const theme = (info?.theme || '').slice(0, 700)
  const deckQuestion = (info?.questionRacine || rootQuestion).slice(0, 300)

  const system = await buildSystemPrompt({
    taskId: 'landing-reading',
    basePrompt: LANDING_READING_BASE_PROMPT,
    locale,
  })
  const systemWithLang = `${FLEUR_CORE_SYSTEM_PROMPT}\n\n${system}\n${getLangInstruction(locale)}`

  const userContent = intention
    ? [
        `INTENTION — base toute la lecture (priorité absolue) :\n« ${intention} »`,
        '',
        `Carte tirée : « ${cardName} »`,
        essence ? `Essence (indice, ne pas recopier) : ${essence}` : '',
        lumiere ? `Lumière deck (indice, ne pas recopier) : ${lumiere}` : '',
        theme ? `Thème étendu (indice) : ${theme}` : '',
        deckQuestion ? `Question racine deck (indice) : ${deckQuestion}` : '',
        '',
        'Construis mirror, reading et question en croisant l\'intention et la carte — lecture personnelle, pas description générique.',
      ]
        .filter((line) => line !== undefined)
        .join('\n')
    : [
        `Carte tirée : « ${cardName} »`,
        essence ? `Essence : ${essence}` : '',
        lumiere ? `Lumière : ${lumiere}` : '',
        theme ? `Thème : ${theme}` : '',
        deckQuestion ? `Question racine : ${deckQuestion}` : '',
        "Intention non précisée — accueillir la carte et inviter à l'écoute personnelle.",
      ]
        .filter(Boolean)
        .join('\n')

  try {
    const raw = await llmCallForTask(
      'landing-reading',
      systemWithLang,
      [{ role: 'user', content: userContent }],
      { maxTokens: 900, responseFormatJson: true }
    )

    if (raw && typeof raw === 'object') {
      const r = raw as Record<string, unknown>
      const mirror = String(r.mirror ?? '').trim().slice(0, 280)
      const reading = String(r.reading ?? '').trim().slice(0, 1200)
      const question = String(r.question ?? '').trim().slice(0, 320)
      const genericFr =
        /cette carte éclaire votre intention en nommant un mouvement intérieur/i.test(reading)
      const genericEn =
        /this card illuminates your intention by naming an inner movement/i.test(reading)
      if (reading.length > 80 && mirror.length > 10 && !genericFr && !genericEn) {
        const out: LandingReadingResult = { mirror, reading, question: question || rootQuestion }
        cacheSet(key, out, CACHE_TTL_MS)
        return out
      }
    }
  } catch {
    /* fallback */
  }

  return buildFallback(cardName, intention, lumiere, rootQuestion, locale)
}
