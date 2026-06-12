/**
 * POST /api/campaigns/answer — soumission réponses participant (token)
 */
import { NextRequest, NextResponse } from 'next/server'
import type { RowDataPacket } from 'mysql2'
import { isDbConfigured, getPool, table } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const body = (await req.json().catch(() => ({}))) as {
      token?: string
      answers?: unknown
      payload?: Record<string, unknown>
    }
    const token = String(body.token ?? '').trim()
    if (!token) return NextResponse.json({ error: 'token requis' }, { status: 400 })

    const pool = getPool()
    const tTok = table('ritual_tokens')
    const tRes = table('ritual_results')

    const [tokRows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM ${tTok} WHERE token = ? LIMIT 1`,
      [token]
    ).catch(() => [[] as RowDataPacket[]])
    const tok = tokRows[0]
    if (!tok) return NextResponse.json({ error: 'Token invalide' }, { status: 404 })

    const campaignId = Number(tok.campaign_id ?? 0)
    const participantId = Number(tok.participant_id ?? 0)
    const payload = body.payload ?? { answers: body.answers ?? body }

    await pool.execute(
      `INSERT INTO ${tRes} (campaign_id, participant_id, payload, created_at) VALUES (?, ?, ?, NOW())`,
      [campaignId || null, participantId || null, JSON.stringify(payload)]
    ).catch(async () => {
      await pool.execute(
        `INSERT INTO ${tRes} (campaign_id, payload, created_at) VALUES (?, ?, NOW())`,
        [campaignId || null, JSON.stringify(payload)]
      )
    })

    return NextResponse.json({ ok: true, saved: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
