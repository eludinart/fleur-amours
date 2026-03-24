'use client'

import { useEffect, useRef, useState } from 'react'
import { diagnosticApi } from '@/api/diagnostic'
import { cardsApi } from '@/api/cards'
import { useStore } from '@/store/useStore'
import { toast } from '@/hooks/useToast'

const PETALS = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'] as const
const PETAL_LABELS: Record<string, string> = {
  agape: 'Agapè', philautia: 'Philautia', mania: 'Mania', storge: 'Storgè',
  pragma: 'Pragma', philia: 'Philia', ludus: 'Ludus', eros: 'Éros',
}
const TRAJECTOIRES = [
  'germination', 'croissance', 'concentration', 'floraison',
  'fructification', 'dormance', 'transformation', 'stagnation', 'régression',
]

type InvariantOpt = { name?: string; slug?: string } | string
type DiagResult = { synthesis?: string; metrics?: unknown; interactions?: unknown }
type SavedDiag = { savedAt?: string; histoire?: string; mode?: string }

export default function DiagnosticPage() {
  const { saveDiagnostic, savedDiagnostics } = useStore()
  const [coeur, setCoeur] = useState<Record<string, number | undefined>>({})
  const [stades, setStades] = useState<InvariantOpt[]>([])
  const [climats, setClimats] = useState<InvariantOpt[]>([])
  const [temps, setTemps] = useState('')
  const [climat, setClimat] = useState('')
  const [histoire, setHistoire] = useState('germination')
  const [mode, setMode] = useState('A')
  const [result, setResult] = useState<DiagResult | null>(null)
  const [loading, setLoading] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    cardsApi.invariants().then((d) => {
      const data = d as { stades_vegetaux?: InvariantOpt[]; climats?: InvariantOpt[] }
      if (data.stades_vegetaux) setStades(data.stades_vegetaux)
      if (data.climats) setClimats(data.climats)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    function drawRadar(vals: Record<string, number | undefined>) {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const n = PETALS.length
      const cx = 140, cy = 140, r = 110
      ctx.clearRect(0, 0, 280, 280)
      const isDark = document.documentElement.classList.contains('dark')
      const borderColor = isDark ? '#334155' : '#e2e8f0'
      const accentColor = isDark ? '#818cf8' : '#6366f1'
      const textColor = isDark ? '#cbd5e1' : '#0f172a'

      ctx.strokeStyle = borderColor
      ctx.lineWidth = 1
      for (let level = 0.25; level <= 1; level += 0.25) {
        ctx.beginPath()
        for (let i = 0; i <= n; i++) {
          const a = (i / n) * 2 * Math.PI - Math.PI / 2
          const x = cx + r * level * Math.cos(a)
          const y = cy + r * level * Math.sin(a)
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.closePath(); ctx.stroke()
      }
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 2 * Math.PI - Math.PI / 2
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
        ctx.stroke()
      }

      ctx.fillStyle = 'rgba(107,92,230,0.30)'
      ctx.strokeStyle = accentColor
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i <= n; i++) {
        const petal = PETALS[i % n]
        const v = Math.min(1, Math.max(0, parseFloat(String(vals[petal] ?? 0)) || 0))
        const a = (i / n) * 2 * Math.PI - Math.PI / 2
        const x = cx + r * v * Math.cos(a)
        const y = cy + r * v * Math.sin(a)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.closePath(); ctx.fill(); ctx.stroke()

      ctx.fillStyle = textColor
      ctx.font = '11px "Plus Jakarta Sans", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 2 * Math.PI - Math.PI / 2
        ctx.fillText(PETAL_LABELS[PETALS[i]], cx + (r + 22) * Math.cos(a), cy + (r + 22) * Math.sin(a))
      }
    }
    drawRadar(coeur)
  }, [coeur])

  async function run(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const r = (await diagnosticApi.run({ coeur, temps, climat, histoire, mode })) as DiagResult
      setResult(r)
    } catch (err) {
      toast('Erreur diagnostic: ' + (err instanceof Error ? err.message : 'Erreur'), 'error')
    } finally {
      setLoading(false)
    }
  }

  function save() {
    if (!result) { toast("Effectuez d'abord un diagnostic", 'error'); return }
    saveDiagnostic({ coeur, temps, climat, histoire, mode, result })
    toast('Diagnostic sauvegardé', 'success')
  }

  const optionLabel = (o: InvariantOpt) => typeof o === 'object' ? String(o.name || o.slug || o) : String(o)
  const optionValue = (o: InvariantOpt) => typeof o === 'object' ? String(o.slug || o) : String(o)

  const inputCls = 'w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40'
  const btnSecondary = 'px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-medium transition-colors'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Diagnostic systémique</h2>
        <button onClick={save} className={btnSecondary}>Sauvegarder</button>
      </div>

      <div className="flex justify-center">
        <canvas ref={canvasRef} width={280} height={280} className="rounded-xl" />
      </div>

      <form onSubmit={run} className="space-y-4">
        <fieldset className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <legend className="text-sm font-semibold px-1 text-slate-600 dark:text-slate-300">Poids des pétales</legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
            {PETALS.map((p) => (
              <label key={p} className="block">
                <span className="text-xs text-slate-500 block mb-1">{PETAL_LABELS[p]}</span>
                <input
                  type="number"
                  step="0.01" min={0} max={1}
                  placeholder="0.00"
                  value={coeur[p] ?? ''}
                  onChange={(e) => setCoeur({ ...coeur, [p]: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                  className={inputCls}
                />
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <label className="block">
            <span className="text-xs text-slate-500 block mb-1">Stade végétal</span>
            <select value={temps} onChange={(e) => setTemps(e.target.value)} className={inputCls}>
              {stades.map((s, i) => <option key={i} value={optionValue(s)}>{optionLabel(s)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-500 block mb-1">Climat</span>
            <select value={climat} onChange={(e) => setClimat(e.target.value)} className={inputCls}>
              {climats.map((c, i) => <option key={i} value={optionValue(c)}>{optionLabel(c)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-500 block mb-1">Trajectoire</span>
            <select value={histoire} onChange={(e) => setHistoire(e.target.value)} className={inputCls}>
              {TRAJECTOIRES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-500 block mb-1">Mode</span>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className={inputCls}>
              <option value="A">Archétypal</option>
              <option value="B">Opérationnel</option>
            </select>
          </label>
        </div>

        <button type="submit" disabled={loading} className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-xl font-semibold disabled:opacity-50 transition-colors">
          {loading ? 'Calcul…' : 'Calculer'}
        </button>
      </form>

      {result && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-3">
          <p className="font-semibold text-lg">{result.synthesis}</p>
          <details open>
            <summary className="cursor-pointer text-sm font-medium text-slate-500">Métriques</summary>
            <pre className="mt-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 rounded-lg p-3 overflow-x-auto">
              {JSON.stringify(result.metrics, null, 2)}
            </pre>
          </details>
          <details>
            <summary className="cursor-pointer text-sm font-medium text-slate-500">Interactions</summary>
            <pre className="mt-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 rounded-lg p-3 overflow-x-auto">
              {JSON.stringify(result.interactions, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {savedDiagnostics.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-slate-500">
            Diagnostics sauvegardés ({savedDiagnostics.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {savedDiagnostics.map((d, i) => (
              <li key={i} className="text-xs text-slate-500 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                {(d as SavedDiag).savedAt?.slice(0, 16)} — {(d as SavedDiag).histoire} / {(d as SavedDiag).mode}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
