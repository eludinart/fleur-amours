/**
 * Idempotence des webhooks Stripe (éviter doubles traitements).
 */
import type { ResultSetHeader } from 'mysql2'
import type { Pool } from 'mysql2/promise'
import { getPool, isDbConfigured, table } from '@/lib/db'

const TBL = () => table('fleur_stripe_webhook_events')

export async function ensureStripeWebhookEventsTable(pool: Pool): Promise<void> {
  const prefix = process.env.DB_PREFIX || 'wp_'
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${prefix}fleur_stripe_webhook_events (
      id VARCHAR(255) NOT NULL PRIMARY KEY,
      event_type VARCHAR(80) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

/**
 * @returns true si cet événement est nouveau et réservé pour traitement, false si déjà vu (réponse 200 sans re-traiter).
 */
export async function claimStripeWebhookEvent(eventId: string, eventType: string): Promise<boolean> {
  if (!eventId) return false
  if (!isDbConfigured()) return false
  const pool = getPool()
  await ensureStripeWebhookEventsTable(pool)
  const [res] = await pool.execute(`INSERT IGNORE INTO ${TBL()} (id, event_type) VALUES (?, ?)`, [
    eventId.slice(0, 255),
    eventType.slice(0, 80),
  ])
  const h = res as ResultSetHeader
  return h.affectedRows === 1
}

/** En cas d’erreur après claim, permettre à Stripe de retenter l’événement. */
export async function releaseStripeWebhookEvent(eventId: string): Promise<void> {
  if (!isDbConfigured() || !eventId) return
  const pool = getPool()
  await ensureStripeWebhookEventsTable(pool)
  await pool.execute(`DELETE FROM ${TBL()} WHERE id = ?`, [eventId.slice(0, 255)])
}
