/**
 * GET /api/admin/db-status
 * Infos de connexion MariaDB et état de santé (admin uniquement).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import {
  isDbConfigured,
  getDbConnectionInfo,
  testConnection,
  getPool,
} from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)

    if (!isDbConfigured()) {
      return NextResponse.json({
        connected: false,
        error: 'MariaDB non configuré (MARIADB_HOST, MARIADB_PASSWORD, etc.)',
        connectionInfo: null,
        version: null,
        poolStats: null,
        latencyMs: null,
      })
    }

    const connectionInfo = getDbConnectionInfo()

    // Mesure de latence et test de connexion
    const start = performance.now()
    const ok = await testConnection()
    const latencyMs = Math.round(performance.now() - start)

    let version: string | null = null
    let poolStats: { connections?: number; latencyMs?: number } | null = null

    if (ok) {
      try {
        const pool = getPool()
        const [rows] = await pool.execute('SELECT VERSION() as VERSION')
        version = (rows as { VERSION?: string }[])?.[0]?.VERSION ?? null
        const poolAny = pool as { _allConnections?: unknown[] }
        poolStats = {
          connections: Array.isArray(poolAny._allConnections)
            ? poolAny._allConnections.length
            : undefined,
          latencyMs,
        }
      } catch {
        poolStats = { latencyMs }
      }
    } else {
      poolStats = { latencyMs }
    }

    return NextResponse.json({
      connected: ok,
      connectionInfo: {
        host: connectionInfo.host,
        port: connectionInfo.port,
        database: connectionInfo.database,
        user: connectionInfo.user,
        prefix: connectionInfo.prefix,
        viaTunnel: connectionInfo.viaTunnel,
        tunnelTarget: connectionInfo.tunnelTarget,
      },
      version,
      poolStats,
      latencyMs,
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message ?? 'Erreur' },
      { status: e.status ?? 401 }
    )
  }
}
