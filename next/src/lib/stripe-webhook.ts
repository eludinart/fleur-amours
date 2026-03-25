/**
 * Vérification signature Stripe (webhook) sans SDK.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyStripeWebhookSignature(
  rawBody: string,
  sigHeader: string | null,
  secret: string
): boolean {
  if (!sigHeader?.trim() || !secret?.trim()) return false

  const chunks = sigHeader.split(',').map((p) => p.trim())
  const ts = chunks.find((c) => c.startsWith('t='))?.slice(2)
  const signatures = chunks.filter((c) => c.startsWith('v1=')).map((c) => c.slice(3))

  if (!ts || signatures.length === 0) return false

  const signedPayload = `${ts}.${rawBody}`
  const expected = createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex')

  return signatures.some((sig) => {
    try {
      const a = Buffer.from(expected, 'hex')
      const b = Buffer.from(sig, 'hex')
      return a.length === b.length && a.length > 0 && timingSafeEqual(a, b)
    } catch {
      return false
    }
  })
}
