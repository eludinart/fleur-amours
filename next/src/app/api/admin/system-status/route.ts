/**
 * GET /api/admin/system-status
 * Infos serveur : hostname, uptime, mémoire, CPU, IP publique, Coolify (optionnel).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import os from 'os'

export const dynamic = 'force-dynamic'

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (d > 0) parts.push(`${d}j`)
  if (h > 0) parts.push(`${h}h`)
  if (m > 0 || parts.length === 0) parts.push(`${m}min`)
  return parts.join(' ')
}

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(1)} Mo`
}

async function fetchPublicIp(): Promise<string | null> {
  try {
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 3000)
    const res = await fetch('https://api.ipify.org?format=json', {
      signal: ctrl.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    const data = (await res.json()) as { ip?: string }
    return data?.ip ?? null
  } catch {
    return null
  }
}

async function fetchCoolifyServers(): Promise<
  { name: string; ip: string; uuid: string; unreachable?: boolean }[] | null
> {
  const url = process.env.COOLIFY_API_URL?.trim()
  const token = process.env.COOLIFY_API_TOKEN?.trim()
  if (!url || !token) return null
  try {
    const base = url.replace(/\/+$/, '')
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 5000)
    const res = await fetch(`${base}/servers`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    const data = (await res.json()) as Array<{
      name?: string
      ip?: string
      uuid?: string
      unreachable_count?: number
    }>
    if (!Array.isArray(data)) return null
    return data.map((s) => ({
      name: s.name ?? '—',
      ip: s.ip ?? '—',
      uuid: s.uuid ?? '',
      unreachable: (s.unreachable_count ?? 0) > 0,
    }))
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)

    const mem = process.memoryUsage()
    const load = os.loadavg()
    const cpus = os.cpus()

    const [publicIp, coolifyServers] = await Promise.all([
      fetchPublicIp(),
      fetchCoolifyServers(),
    ])

    return NextResponse.json({
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      uptimeSeconds: Math.floor(process.uptime()),
      uptimeFormatted: formatUptime(process.uptime()),
      memory: {
        heapUsed: formatBytes(mem.heapUsed),
        heapTotal: formatBytes(mem.heapTotal),
        rss: formatBytes(mem.rss),
        external: formatBytes(mem.external ?? 0),
      },
      memoryRaw: {
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        rss: mem.rss,
      },
      cpu: {
        cores: cpus.length,
        loadAvg1m: load[0]?.toFixed(2) ?? '—',
        loadAvg5m: load[1]?.toFixed(2) ?? '—',
        loadAvg15m: load[2]?.toFixed(2) ?? '—',
      },
      publicIp: publicIp ?? null,
      nodeEnv: process.env.NODE_ENV ?? 'development',
      coolify: coolifyServers
        ? {
            configured: true,
            servers: coolifyServers,
          }
        : { configured: false, servers: [] },
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message ?? 'Erreur' },
      { status: e.status ?? 401 }
    )
  }
}
