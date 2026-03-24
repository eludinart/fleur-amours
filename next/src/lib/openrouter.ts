/**
 * Client OpenRouter pour les appels IA.
 */
import { getOpenRouterModel } from './openrouter-config'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface OpenRouterOptions {
  maxTokens?: number
  rawText?: boolean
  responseFormatJson?: boolean
}

/**
 * Appel OpenRouter.
 * @returns JSON parsé, ou texte brut si rawText, ou null en cas d'erreur.
 */
export async function openrouterCall(
  system: string,
  messages: OpenRouterMessage[],
  options: OpenRouterOptions = {}
): Promise<Record<string, unknown> | string | null> {
  const {
    maxTokens = 1200,
    rawText = false,
    responseFormatJson = false,
  } = options

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return null
  }

  const payload = {
    model: getOpenRouterModel(),
    messages: [
      { role: 'system' as const, content: system },
      ...messages,
    ],
    max_tokens: maxTokens,
    ...(responseFormatJson && { response_format: { type: 'json_object' as const } }),
  }

  const maxAttempts = 2
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) await new Promise((r) => setTimeout(r, 2000))

    let res: Response
    try {
      res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') || '',
          'X-Title': "Fleur d'AmOurs",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(90000),
      })
    } catch (err) {
      if (attempt < maxAttempts) continue
      return null
    }

    if (res.status >= 400) {
      if (res.status === 429 && attempt < maxAttempts) continue
      return null
    }

    const data = await res.json().catch(() => null)
    const rawContent = data?.choices?.[0]?.message?.content
    const content =
      typeof rawContent === 'string'
        ? rawContent
        : Array.isArray(rawContent)
          ? rawContent[0]?.text ?? ''
          : ''

    if (!data || content === '') {
      if (attempt < maxAttempts) continue
      return null
    }

    if (rawText) return typeof content === 'string' ? content.trim() : ''

    const parsed = parseJsonFromContent(content)
    if (parsed) return parsed
  }

  return null
}

function parseJsonFromContent(text: string): Record<string, unknown> | null {
  let t = text.trim()
  t = t.replace(/<think>[\s\S]*?<\/think>/g, '').trim()

  const candidates: string[] = [t]
  const codeBlockMatch = t.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)
  for (const m of codeBlockMatch) {
    if (m[1]) candidates.push(m[1].trim())
  }
  const prefixMatch = t.match(
    /^(?:Voici|Here is|Sure,?|OK[,:]?)\s*(?:the\s+)?(?:JSON\s*:?\s*)?/iu
  )
  if (prefixMatch) {
    candidates.push(t.slice(prefixMatch[0].length).trim())
  }

  for (const c of candidates) {
    const trimmed = c.trim()
    if (!trimmed.includes('{')) continue
    let decoded = jsonParse(trimmed)
    if (decoded) return decoded
    const start = trimmed.indexOf('{')
    let depth = 0
    let end = start
    for (let i = start; i < trimmed.length; i++) {
      if (trimmed[i] === '{') depth++
      else if (trimmed[i] === '}') {
        depth--
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    const chunk = trimmed.slice(start, end + 1)
    decoded = jsonParse(chunk)
    if (decoded) return decoded
    const repaired = chunk.replace(/,\s*([}\]])/g, '$1')
    decoded = jsonParse(repaired)
    if (decoded) return decoded
  }
  return null
}

function jsonParse(str: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(str)
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? v : null
  } catch {
    return null
  }
}
