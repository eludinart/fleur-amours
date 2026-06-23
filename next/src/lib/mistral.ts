/**
 * Client Mistral AI (API chat completions).
 */
import { getMistralModelFromEnv } from './mistral-config'

const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions'

export interface MistralMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface MistralOptions {
  maxTokens?: number
  rawText?: boolean
  responseFormatJson?: boolean
  timeoutMs?: number
  maxAttempts?: number
  model?: string
}

export async function mistralCall(
  system: string,
  messages: MistralMessage[],
  options: MistralOptions = {}
): Promise<Record<string, unknown> | string | null> {
  const {
    maxTokens = 1200,
    rawText = false,
    responseFormatJson = false,
    timeoutMs = 90000,
    maxAttempts = 2,
    model,
  } = options

  const apiKey = process.env.MISTRAL_API_KEY?.trim()
  if (!apiKey) return null

  const payload = {
    model: model || getMistralModelFromEnv(),
    messages: [{ role: 'system' as const, content: system }, ...messages],
    max_tokens: maxTokens,
    ...(responseFormatJson && { response_format: { type: 'json_object' as const } }),
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) await new Promise((r) => setTimeout(r, 2000))

    let res: Response
    try {
      res = await fetch(MISTRAL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch {
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
