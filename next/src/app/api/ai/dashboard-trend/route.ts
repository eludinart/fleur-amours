/**
 * POST /api/ai/dashboard-trend
 * Niveau 3 : mouvement **comparatif** entre instantanés — pas le profil dominant instantané.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)
    const body = (await req.json().catch(() => ({}))) as { snapshots?: unknown[] }
    const snapshots = Array.isArray(body.snapshots) ? body.snapshots : []
    if (snapshots.length < 2) return NextResponse.json({ trend: '' })

    const recent = (snapshots[0] ?? {}) as Record<string, unknown>
    const older = (snapshots[snapshots.length - 1] ?? {}) as Record<string, unknown>

    const pets: string[] = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros']

    const recentPetals = (recent?.petals && typeof recent.petals === 'object' ? recent.petals : {}) as Record<
      string,
      number
    >
    const olderPetals = (older?.petals && typeof older.petals === 'object' ? older.petals : {}) as Record<
      string,
      number
    >

    const deltas = pets
      .map((p) => {
        const rv = Number(recentPetals[p] ?? 0)
        const ov = Number(olderPetals[p] ?? 0)
        return { p, delta: rv - ov, rv, ov }
      })
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

    const maxAbs = Math.abs(deltas[0]?.delta ?? 0)
    const locale = String(req.headers.get('x-locale') ?? 'fr')
      .toLowerCase()
      .split('-')[0]

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
        storge: 'Storgè',
        pragma: 'Pragma',
        philia: 'Filia',
        ludus: 'Ludus',
        eros: 'Eros',
      }
      const de: Record<string, string> = {
        agape: 'Agape',
        philautia: 'Philautia',
        mania: 'Mania',
        storge: 'Storge',
        pragma: 'Pragma',
        philia: 'Philia',
        ludus: 'Ludus',
        eros: 'Eros',
      }
      const it: Record<string, string> = {
        agape: 'Agape',
        philautia: 'Philautia',
        mania: 'Mania',
        storge: 'Storge',
        pragma: 'Pragma',
        philia: 'Philia',
        ludus: 'Ludus',
        eros: 'Eros',
      }
      if (locale === 'en') return en[petal] ?? petal
      if (locale === 'es') return es[petal] ?? petal
      if (locale === 'de') return de[petal] ?? petal
      if (locale === 'it') return it[petal] ?? petal
      return fr[petal] ?? petal
    }

    const STABLE_THRESHOLD = 0.08

    let trend = ''
    if (maxAbs < STABLE_THRESHOLD) {
      if (locale === 'en') {
        trend = 'Across your recent snapshots, the flower barely moves — a quiet stretch worth noticing.'
      } else if (locale === 'es') {
        trend = 'Entre tus instantáneas recientes, la flor casi no se mueve — un tramo tranquilo para notar.'
      } else if (locale === 'de') {
        trend = 'Zwischen deinen letzten Momentaufnahmen bewegt sich die Blume kaum — eine ruhige Phase.'
      } else if (locale === 'it') {
        trend = 'Tra le tue istantanee recenti, il fiore si muove poco — una fase calma da notare.'
      } else {
        trend =
          'Sur tes derniers instantanés, la fleur bouge à peine — un passage plus stable, à remarquer doucement.'
      }
    } else {
      const d0 = deltas[0]
      const petalName = d0?.p ? nameByPetal(d0.p) : ''
      const rising = (d0?.delta ?? 0) > 0

      const topUp = deltas.filter((d) => d.delta >= STABLE_THRESHOLD / 2).sort((a, b) => b.delta - a.delta)[0]
      const topDown = deltas.filter((d) => d.delta <= -STABLE_THRESHOLD / 2).sort((a, b) => a.delta - b.delta)[0]

      if (locale === 'en') {
        trend = `From your oldest to your newest snapshot here, ${petalName} has ${rising ? 'swung up the most' : 'eased the most'}.`
        if (
          topUp &&
          topDown &&
          topUp.p !== topDown.p &&
          topUp.p !== d0?.p &&
          topDown.p !== d0?.p
        ) {
          trend += ` At the same time, ${nameByPetal(topUp.p)} lifts while ${nameByPetal(topDown.p)} loosens.`
        } else if (topUp && topUp.p !== d0?.p && topUp.delta >= STABLE_THRESHOLD / 2) {
          trend += ` ${nameByPetal(topUp.p)} also gains a little height.`
        } else if (topDown && topDown.p !== d0?.p && Math.abs(topDown.delta) >= STABLE_THRESHOLD / 2) {
          trend += ` ${nameByPetal(topDown.p)} also softens alongside.`
        }
      } else if (locale === 'es') {
        trend = `Del instante más antiguo al más reciente de este tramo, ${petalName} es ${rising ? 'la que más sube' : 'la que más cede'}.`
        if (topUp && topDown && topUp.p !== topDown.p && topUp.p !== d0?.p && topDown.p !== d0?.p) {
          trend += ` En paralelo, ${nameByPetal(topUp.p)} gana terreno y ${nameByPetal(topDown.p)} afloja.`
        } else if (topUp && topUp.p !== d0?.p && topUp.delta >= STABLE_THRESHOLD / 2) {
          trend += ` ${nameByPetal(topUp.p)} también sube un poco.`
        } else if (topDown && topDown.p !== d0?.p && Math.abs(topDown.delta) >= STABLE_THRESHOLD / 2) {
          trend += ` ${nameByPetal(topDown.p)} también se relaja.`
        }
      } else if (locale === 'de') {
        trend = `Vom ältesten zum neuesten Snapshot hier hat sich ${petalName} am stärksten ${rising ? 'gehoben' : 'entspannt'}.`
        if (topUp && topDown && topUp.p !== topDown.p && topUp.p !== d0?.p && topDown.p !== d0?.p) {
          trend += ` Gleichzeitig gewinnt ${nameByPetal(topUp.p)} an Höhe, während ${nameByPetal(topDown.p)} nachgibt.`
        } else if (topUp && topUp.p !== d0?.p && topUp.delta >= STABLE_THRESHOLD / 2) {
          trend += ` ${nameByPetal(topUp.p)} steigt auch leicht.`
        } else if (topDown && topDown.p !== d0?.p && Math.abs(topDown.delta) >= STABLE_THRESHOLD / 2) {
          trend += ` ${nameByPetal(topDown.p)} lockert ebenfalls.`
        }
      } else if (locale === 'it') {
        trend = `Dall’istantanea più vecchia alla più recente in questa finestra, ${petalName} è ${rising ? 'quella che sale di più' : 'quella che si attenua di più'}.`
        if (topUp && topDown && topUp.p !== topDown.p && topUp.p !== d0?.p && topDown.p !== d0?.p) {
          trend += ` In parallelo, ${nameByPetal(topUp.p)} sale mentre ${nameByPetal(topDown.p)} molla.`
        } else if (topUp && topUp.p !== d0?.p && topUp.delta >= STABLE_THRESHOLD / 2) {
          trend += ` Anche ${nameByPetal(topUp.p)} sale un poco.`
        } else if (topDown && topDown.p !== d0?.p && Math.abs(topDown.delta) >= STABLE_THRESHOLD / 2) {
          trend += ` Anche ${nameByPetal(topDown.p)} si ammorbidisce.`
        }
      } else {
        trend = `Entre l’instantané le plus ancien et le plus récent de cette fenêtre, c’est ${petalName} qui ${rising ? 'bouge le plus vers le haut' : 'se détend le plus'}.`
        if (topUp && topDown && topUp.p !== topDown.p && topUp.p !== d0?.p && topDown.p !== d0?.p) {
          trend += ` En parallèle, ${nameByPetal(topUp.p)} prend de la hauteur tandis que ${nameByPetal(topDown.p)} lâche du lest.`
        } else if (topUp && topUp.p !== d0?.p && topUp.delta >= STABLE_THRESHOLD / 2) {
          trend += ` ${nameByPetal(topUp.p)} monte aussi un peu.`
        } else if (topDown && topDown.p !== d0?.p && Math.abs(topDown.delta) >= STABLE_THRESHOLD / 2) {
          trend += ` ${nameByPetal(topDown.p)} se détend aussi.`
        }
      }
    }

    return NextResponse.json({ trend: trend.trim() })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
