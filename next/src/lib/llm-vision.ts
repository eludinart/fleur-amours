/**
 * Appels vision multimodaux (OpenRouter ou Mistral Pixtral).
 */
import { getAiRuntimeConfig, resolveModelForTier, isMistralKeyConfigured, isOpenRouterKeyConfigured } from './db-ai-config'
import type { AiTier } from './ai-tiers'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions'

const VISION_MODEL_FALLBACK: Record<'openrouter' | 'mistral', string> = {
  openrouter: 'google/gemini-2.5-flash',
  mistral: 'pixtral-large-latest',
}

type VisionContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } | string }

async function resolveVisionModel(tier: AiTier = 'premium'): Promise<{
  provider: 'openrouter' | 'mistral'
  model: string
}> {
  const cfg = await getAiRuntimeConfig()
  const baseModel = await resolveModelForTier(tier, cfg)
  const provider = cfg.provider === 'mistral' ? 'mistral' : 'openrouter'
  const model =
    baseModel.toLowerCase().includes('pixtral') ||
    baseModel.toLowerCase().includes('vision') ||
    baseModel.toLowerCase().includes('gemini') ||
    baseModel.toLowerCase().includes('gpt-4o') ||
    baseModel.toLowerCase().includes('claude')
      ? baseModel
      : VISION_MODEL_FALLBACK[provider]
  return { provider, model }
}

function parseJsonArray(text: string): unknown[] | null {
  let t = text.trim()
  t = t.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  const candidates = [t]
  const blocks = t.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)
  for (const m of blocks) {
    if (m[1]) candidates.push(m[1].trim())
  }
  for (const c of candidates) {
    const start = c.indexOf('[')
    const end = c.lastIndexOf(']')
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(c.slice(start, end + 1))
        if (Array.isArray(parsed)) return parsed
      } catch {
        /* continue */
      }
    }
    try {
      const parsed = JSON.parse(c)
      if (Array.isArray(parsed)) return parsed
      if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { cards?: unknown }).cards)) {
        return (parsed as { cards: unknown[] }).cards
      }
    } catch {
      /* continue */
    }
  }
  return null
}

export async function llmVisionJson(
  system: string,
  userText: string,
  imageDataUrl: string,
  options: { tier?: AiTier; maxTokens?: number } = {}
): Promise<unknown[] | null> {
  const { tier = 'premium', maxTokens = 1200 } = options
  const { provider, model } = await resolveVisionModel(tier)

  const imageUrl = imageDataUrl.startsWith('data:')
    ? imageDataUrl
    : `data:image/jpeg;base64,${imageDataUrl}`

  const userContent: VisionContentPart[] = [
    { type: 'text', text: userText },
    { type: 'image_url', image_url: { url: imageUrl } },
  ]

  if (provider === 'mistral') {
    if (!isMistralKeyConfigured()) return null
    const apiKey = process.env.MISTRAL_API_KEY?.trim()
    const mistralContent = [
      { type: 'text', text: userText },
      { type: 'image_url', image_url: imageUrl },
    ]
    const res = await fetch(MISTRAL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: mistralContent },
        ],
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(120000),
    })
    if (!res.ok) return null
    const data = await res.json().catch(() => null)
    const raw = data?.choices?.[0]?.message?.content
    const text = typeof raw === 'string' ? raw : ''
    if (!text) return null
    return parseJsonArray(text)
  }

  if (!isOpenRouterKeyConfigured()) return null
  const apiKey = process.env.OPENROUTER_API_KEY
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') || '',
      'X-Title': "Fleur d'AmOurs",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(120000),
  })
  if (!res.ok) return null
  const data = await res.json().catch(() => null)
  const raw = data?.choices?.[0]?.message?.content
  const text = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0]?.text ?? '' : ''
  if (!text) return null
  return parseJsonArray(text)
}
