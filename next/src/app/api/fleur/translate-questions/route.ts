/**
 * POST /api/fleur/translate-questions
 * Traduit les questions QCM Fleur (label_en, label_es) via OpenRouter.
 * MariaDB : ritual_questions, ritual_question_choices
 */
import { NextRequest, NextResponse } from 'next/server'
import type { RowDataPacket } from 'mysql2'
import { getPool, table, isDbConfigured } from '@/lib/db'
import { getOpenRouterModel } from '@/lib/openrouter-config'

export const dynamic = 'force-dynamic'

async function translateBatch(texts: string[], targetLang: 'en' | 'es'): Promise<string[]> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey || texts.length === 0) return []

  const langName = targetLang === 'en' ? 'English' : 'Spanish'
  const numbered = texts.map((t, i) => `${i + 1}. ${t}`).join('\n')
  const model = getOpenRouterModel()

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: `Translate the following numbered list from French to ${langName}. Return ONLY a JSON array of translated strings, same order. Example: ["tr1","tr2"]`,
        },
        { role: 'user', content: numbered },
      ],
      max_tokens: 2000,
    }),
  })

  if (!res.ok) return []
  const data = await res.json()
  const raw = data?.choices?.[0]?.message?.content?.trim() || ''
  const cleaned = raw.replace(/^```\w*\s*/i, '').replace(/\s*```$/, '')
  try {
    const arr = JSON.parse(cleaned)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'MariaDB non configuré' }, { status: 503 })
    }
    const body = await req.json().catch(() => ({}))
    const slug = body.slug || 'fleur-amour-individuel'
    const dryRun = !!body.dry_run
    const force = !!body.force

    const pool = getPool()
    const tDef = table('ritual_definitions')
    const tQ = table('ritual_questions')
    const tC = table('ritual_question_choices')

    for (const tbl of [tQ, tC]) {
      for (const col of ['label_en', 'label_es']) {
        try {
          await pool.execute(`ALTER TABLE ${tbl} ADD COLUMN ${col} TEXT NULL`)
        } catch {
          /* colonne déjà présente */
        }
      }
    }

    const [defRows] = await pool.execute<RowDataPacket[]>(`SELECT id FROM ${tDef} WHERE slug = ?`, [slug])
    if (!defRows[0]) return NextResponse.json({ error: `Slug not found: ${slug}` }, { status: 404 })
    const defId = Number(defRows[0].id)

    const whereClause = force ? '' : ' AND (label_en IS NULL OR label_en = \'\')'
    const [questions] = await pool.execute<RowDataPacket[]>(
      `SELECT id, label FROM ${tQ} WHERE definition_id = ?${whereClause}`,
      [defId]
    )
    const [choices] = await pool.execute<RowDataPacket[]>(
      `SELECT c.id, c.label FROM ${tC} c JOIN ${tQ} q ON q.id = c.question_id WHERE q.definition_id = ?${force ? '' : ' AND (c.label_en IS NULL OR c.label_en = \'\')'}`,
      [defId]
    )

    if (questions.length === 0 && choices.length === 0) {
      return NextResponse.json({ status: 'already_done', count: 0 })
    }

    const items: Array<{ tbl: string; id: number; label: string }> = []
    questions.forEach((r) => items.push({ tbl: tQ, id: Number(r.id), label: String(r.label ?? '') }))
    choices.forEach((r) => items.push({ tbl: tC, id: Number(r.id), label: String(r.label ?? '') }))

    if (dryRun) {
      return NextResponse.json({ status: 'dry_run', count: items.length, log: items.map((i) => `${i.tbl} #${i.id}`) })
    }

    const texts = items.map((i) => i.label)
    const enTr = await translateBatch(texts, 'en')
    const esTr = await translateBatch(texts, 'es')

    const log: string[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const en = enTr[i]
      const es = esTr[i]
      if (en || es) {
        const parts: string[] = []
        const vals: (string | number)[] = []
        if (en) {
          parts.push('label_en = ?')
          vals.push(en)
        }
        if (es) {
          parts.push('label_es = ?')
          vals.push(es)
        }
        vals.push(item.id)
        await pool.execute(`UPDATE ${item.tbl} SET ${parts.join(', ')} WHERE id = ?`, vals)
        log.push(`${item.tbl} #${item.id}`)
      }
    }

    return NextResponse.json({ status: 'ok', count: log.length, log })
  } catch (err) {
    const e = err as Error
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
