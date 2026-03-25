/**
 * POST /api/ai/dashboard-trend
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)
    const body = (await req.json().catch(() => ({}))) as { snapshots?: any[] }
    const snapshots = Array.isArray(body.snapshots) ? body.snapshots : []
    if (snapshots.length < 2) return NextResponse.json({ trend: '' })

    // snapshots sont triés descendant (le plus récent en premier) côté fetchDashboardData.
    const recent = snapshots[0] ?? {}
    const older = snapshots[snapshots.length - 1] ?? {}

    const pets: string[] = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros']

    const recentPetals = (recent?.petals && typeof recent.petals === 'object' ? recent.petals : {}) as Record<string, number>
    const olderPetals = (older?.petals && typeof older.petals === 'object' ? older.petals : {}) as Record<string, number>

    const recentMax = pets
      .map((p) => ({ p, v: Number(recentPetals[p] ?? 0) }))
      .sort((a, b) => b.v - a.v)[0]

    const deltas = pets
      .map((p) => {
        const rv = Number(recentPetals[p] ?? 0)
        const ov = Number(olderPetals[p] ?? 0)
        return { p, delta: rv - ov, rv, ov }
      })
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

    const maxAbs = deltas[0]?.delta ?? 0
    const locale = String(req.headers.get('x-locale') ?? 'fr').toLowerCase()

    const nameByPetal = (petal: string) => {
      const fr: Record<string, string> = {
        agape: 'Agapè',
        philautia: 'Philautia',
        mania: 'Mania',
        storge: 'Storgè',
        pragma: 'Pragma',
        philia: 'Philia',
        ludus: 'Ludus',
        eros: 'Éros',
      }
      const en: Record<string, string> = {
        agape: 'Agape',
        philautia: 'Philautia',
        mania: 'Mania',
        storge: 'Storge',
        pragma: 'Pragma',
        philia: 'Philia',
        ludus: 'Ludus',
        eros: 'Eros',
      }
      const es: Record<string, string> = {
        agape: 'Ágape',
        philautia: 'Filautia',
        mania: 'Manía',
        storge: 'Storgé',
        pragma: 'Pragma',
        philia: 'Filia',
        ludus: 'Ludus',
        eros: 'Eros',
      }
      if (locale === 'en') return en[petal] ?? petal
      if (locale === 'es') return es[petal] ?? petal
      return fr[petal] ?? petal
    }

    const topUp = deltas.filter((d) => d.delta >= 0).sort((a, b) => b.delta - a.delta)[0]
    const topDown = deltas.filter((d) => d.delta < 0).sort((a, b) => a.delta - b.delta)[0]

    const STABLE_THRESHOLD = 0.08

    let trend = ''
    if (Math.abs(maxAbs) < STABLE_THRESHOLD) {
      trend =
        locale === 'en'
          ? `Over the last snapshots, the overall pattern looks fairly stable.`
          : locale === 'es'
            ? `En las últimas exploraciones, el patrón general parece bastante estable.`
            : `Sur les derniers snapshots, le motif global paraît assez stable.`
    } else {
      const main = recentMax ? nameByPetal(recentMax.p) : ''
      const dir =
        maxAbs >= 0
          ? locale === 'en'
            ? 'seems to be rising'
            : locale === 'es'
              ? 'parece estar en alza'
              : 'semble s’intensifier'
          : locale === 'en'
            ? 'seems to be easing'
            : locale === 'es'
              ? 'parece aflojar'
              : 'semble se détendre'

      const changePetal = deltas[0]?.p ? nameByPetal(deltas[0].p) : ''

      const upPart =
        topUp && topUp.delta >= STABLE_THRESHOLD / 2
          ? locale === 'en'
            ? `You can also notice ${nameByPetal(topUp.p)} moving upward.`
            : locale === 'es'
              ? `También puedes notar un avance de ${nameByPetal(topUp.p)}.`
              : `On peut aussi percevoir un mouvement vers le haut de ${nameByPetal(topUp.p)}.`
          : ''

      const downPart =
        topDown && Math.abs(topDown.delta) >= STABLE_THRESHOLD / 2
          ? locale === 'en'
            ? `And ${nameByPetal(topDown.p)} seems to be cooling down.`
            : locale === 'es'
              ? `Y ${nameByPetal(topDown.p)} parece enfriarse.`
              : `Et ${nameByPetal(topDown.p)} semble se calmer.`
          : ''

      trend =
        locale === 'en'
          ? `It seems your current pattern is shifting toward ${main}${changePetal ? ` — ${changePetal} ${dir}` : ''}. ${upPart} ${downPart}`.trim()
          : locale === 'es'
            ? `Parece que tu patrón actual se está moviendo hacia ${main}${changePetal ? ` — ${changePetal} ${dir}` : ''}. ${upPart} ${downPart}`.trim()
            : `Il semble que votre motif actuel se déplace vers ${main}${changePetal ? ` — ${changePetal} ${dir}` : ''}. ${upPart} ${downPart}`.trim()
    }

    // Non-manipulatoire : on garde le ton “il semble que”.
    trend = trend.replace(/^\s*Il semble que/, locale === 'en' ? 'It seems that' : trend.startsWith('Il semble que') ? 'Il semble que' : trend)

    return NextResponse.json({ trend })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
