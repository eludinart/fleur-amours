'use client'

import { useEffect, useRef, useState } from 'react'
import { graphApi } from '@/api/graph'
import { cardsApi } from '@/api/cards'
import { cardImageUrl } from '@/lib/api-client'
import { toast } from '@/hooks/useToast'

const LAYOUTS = ['circle', 'concentric', 'grid', 'cose']

type GraphNode = { id: string; label?: string }
type GraphEdge = { source: string; target: string; weight?: number; tags?: string[] }
type GraphData = { nodes: GraphNode[]; edges: GraphEdge[] }

declare global {
  interface Window {
    cytoscape?: (opts: { container: HTMLElement; elements: unknown[]; style: unknown[]; layout: { name: string } }) => {
      layout: (opts: { name: string }) => { run: () => void }
      nodes: () => { forEach: (fn: (n: { id: () => string; addClass: (c: string) => void }) => void) => void }
      on: (ev: string, sel: string, fn: (ev: { target: { id: () => string } }) => void) => void
      zoom: (z?: number) => number
      png: (opts: { full?: boolean; scale?: number }) => string
    }
  }
}

function NodeDetail({ slug, graphData }: { slug: string; graphData: GraphData | null }) {
  const [card, setCard] = useState<{ name?: string; slug?: string; meta?: { image?: string }; tags?: string[] } | null>(null)
  useEffect(() => {
    cardsApi.get(slug).then((d) => setCard(d as typeof card)).catch(() => {})
  }, [slug])
  if (!card) return null
  const imgUrl = cardImageUrl(card.meta?.image)
  const links = (graphData?.edges ?? []).filter((e) => e.source === slug || e.target === slug)
  const slugToName = Object.fromEntries((graphData?.nodes ?? []).map((n) => [n.id, n.label ?? n.id]))
  return (
    <aside className="w-64 shrink-0 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3 overflow-y-auto max-h-[480px]">
      <h3 className="font-bold text-base">{card.name ?? card.slug}</h3>
      {imgUrl && <img src={imgUrl} alt={card.name ?? ''} className="w-full rounded-xl object-contain" />}
      <p className="text-xs text-slate-400">{card.slug}</p>
      {card.tags && card.tags.length > 0 && <p className="text-xs"><strong>Tags :</strong> {card.tags.join(', ')}</p>}
      {links.length > 0 && (
        <div className="text-xs">
          <strong>Liens :</strong>
          <ul className="mt-1 space-y-0.5 list-disc list-inside">
            {links.map((e, i) => {
              const other = e.source === slug ? e.target : e.source
              return <li key={i}>{slugToName[other] ?? other} ({e.tags ? e.tags.join(', ') : (e.weight ?? 1) + ' tags'})</li>
            })}
          </ul>
        </div>
      )}
    </aside>
  )
}

function MatrixView({ graphData }: { graphData: GraphData }) {
  const slugToName = Object.fromEntries((graphData.nodes ?? []).map((n) => [n.id, n.label ?? n.id]))
  const sorted = [...(graphData.edges ?? [])].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800">
          <tr>
            {['Carte A', 'Carte B', 'Tags partagés', 'Nb'].map((h) => (
              <th key={h} className="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((e, i) => (
            <tr key={i} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="px-4 py-2">{slugToName[e.source] ?? e.source}</td>
              <td className="px-4 py-2">{slugToName[e.target] ?? e.target}</td>
              <td className="px-4 py-2 text-slate-500">{e.tags ? e.tags.join(', ') : '—'}</td>
              <td className="px-4 py-2 font-mono">{e.weight ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SimTable({ result }: { result: { slugs?: string[]; timeline?: Record<string, number>[] } }) {
  const { slugs = [], timeline = [] } = result
  return (
    <div className="overflow-x-auto mt-3 rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="text-xs min-w-full">
        <thead className="bg-slate-50 dark:bg-slate-800">
          <tr>
            <th className="px-3 py-1.5 text-left">step</th>
            {slugs.map((s) => <th key={s} className="px-3 py-1.5 text-left">{s}</th>)}
          </tr>
        </thead>
        <tbody>
          {timeline.map((st, i) => (
            <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-3 py-1">{i}</td>
              {slugs.map((s) => (
                <td key={s} className="px-3 py-1 font-mono">{((st as Record<string, number>)[s] ?? 0).toFixed(3)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const inputCls = 'px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40'
const btnCls = 'px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-xl text-sm font-semibold transition-colors'
const btnSecondary = 'px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-medium transition-colors'

export default function GraphPage() {
  const [minShared, setMinShared] = useState(1)
  const [layout, setLayout] = useState('circle')
  const [view, setView] = useState<'graph' | 'matrix'>('graph')
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [simSeeds, setSimSeeds] = useState('')
  const [simSteps, setSimSteps] = useState(6)
  const [simDecay, setSimDecay] = useState(0.6)
  const [simResult, setSimResult] = useState<{ slugs?: string[]; timeline?: Record<string, number>[] } | null>(null)
  const cyRef = useRef<{ layout: (o: { name: string }) => { run: () => void }; nodes: () => { forEach: (fn: (n: { id: () => string; addClass: (c: string) => void }) => void) => void }; zoom: (z?: number) => number; png: (opts: { full?: boolean; scale?: number }) => string } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  function renderCytoscape(g: GraphData, simState?: Record<string, number>) {
    if (!containerRef.current || typeof window.cytoscape === 'undefined') return
    containerRef.current.innerHTML = ''
    const elements = [
      ...(g.nodes ?? []).map((n) => ({ data: { id: n.id, label: n.label } })),
      ...(g.edges ?? []).map((e) => ({ data: { source: e.source, target: e.target, weight: e.weight || 1 } })),
    ]
    const cy = window.cytoscape!({
      container: containerRef.current,
      elements,
      style: [
        { selector: 'node', style: { label: 'data(label)', 'background-color': '#6366f1', color: '#fff', 'text-valign': 'center', 'text-wrap': 'wrap', 'font-size': '11px', width: 36, height: 36, 'text-max-width': 80 } },
        { selector: 'edge', style: { width: 'mapData(weight, 1, 8, 1.5, 5)', 'line-color': '#94a3b8', 'curve-style': 'bezier', opacity: 0.7 } },
        { selector: '.sim-active', style: { 'background-color': '#10b981' } },
      ],
      layout: { name: layout },
    })
    cy.on('tap', 'node', (ev: { target: { id: () => string } }) => setSelectedNode(ev.target.id()))
    cyRef.current = cy
    if (simState) {
      cy.nodes().forEach((n) => {
        const val = simState[n.id()]
        if (val !== undefined && val > 0) n.addClass('sim-active')
      })
    }
  }

  async function loadGraph() {
    try {
      const g = (await graphApi.get(minShared)) as GraphData
      setGraphData(g)
      if (view === 'graph') renderCytoscape(g)
    } catch (e) {
      toast('Erreur graphe: ' + (e instanceof Error ? e.message : 'Erreur'), 'error')
    }
  }

  async function runSim() {
    const seeds = simSeeds.split(',').map((s) => s.trim()).filter(Boolean)
    if (!seeds.length) { toast('Entrez au moins un slug seed', 'error'); return }
    try {
      const r = (await graphApi.simulate(seeds, simSteps, simDecay)) as { slugs?: string[]; timeline?: Record<string, number>[] }
      setSimResult(r)
      if (graphData && view === 'graph') {
        const last = (r.timeline ?? []).slice(-1)[0] ?? {}
        renderCytoscape(graphData, last)
      }
    } catch (e) {
      toast('Erreur simulation: ' + (e instanceof Error ? e.message : 'Erreur'), 'error')
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!(window as unknown as { cytoscape?: unknown }).cytoscape) {
      const s = document.createElement('script')
      s.src = 'https://unpkg.com/cytoscape/dist/cytoscape.min.js'
      s.onload = () => graphData && renderCytoscape(graphData)
      document.body.appendChild(s)
    }
  }, [])

  useEffect(() => {
    cyRef.current?.layout({ name: layout }).run()
  }, [layout])

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Relations entre cartes</h2>

      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm">
          Min. tags partagés
          <input
            type="number"
            min={1}
            value={minShared}
            onChange={(e) => setMinShared(Number(e.target.value))}
            className={inputCls + ' w-20 ml-2'}
          />
        </label>
        <label className="text-sm">
          Disposition
          <select value={layout} onChange={(e) => setLayout(e.target.value)} className={inputCls + ' ml-2'}>
            {LAYOUTS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <button onClick={loadGraph} className={btnCls}>Afficher</button>
        <button onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.2)} className={btnSecondary}>+</button>
        <button onClick={() => cyRef.current?.zoom(cyRef.current.zoom() / 1.2)} className={btnSecondary}>−</button>
        <button
          onClick={() => {
            if (!cyRef.current) return
            const a = document.createElement('a')
            a.href = cyRef.current.png({ full: true, scale: 2 })
            a.download = 'graph.png'
            a.click()
          }}
          className={btnSecondary}
        >
          Export PNG
        </button>
      </div>

      <div className="flex gap-2">
        {(['graph', 'matrix'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${view === v ? 'bg-accent text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
          >
            {v === 'graph' ? 'Vue graphe' : 'Vue tableau'}
          </button>
        ))}
      </div>

      {view === 'graph' && (
        <div className="flex gap-4">
          <div
            ref={containerRef}
            className="flex-1 min-h-[480px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          />
          {selectedNode && <NodeDetail slug={selectedNode} graphData={graphData} />}
        </div>
      )}

      {view === 'matrix' && graphData && (
        <MatrixView graphData={graphData} />
      )}

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-600 dark:text-slate-300">
          Simulation de propagation
        </summary>
        <div className="mt-3 flex flex-wrap gap-3 items-end">
          <label className="text-sm">
            Seeds (slugs)
            <input
              className={inputCls + ' ml-2 w-48'}
              value={simSeeds}
              onChange={(e) => setSimSeeds(e.target.value)}
              placeholder="le_feu, l_eau"
            />
          </label>
          <label className="text-sm">
            Étapes
            <input type="number" min={1} value={simSteps} onChange={(e) => setSimSteps(Number(e.target.value))} className={inputCls + ' ml-2 w-16'} />
          </label>
          <label className="text-sm">
            Décroissance
            <input type="number" step={0.1} min={0} max={1} value={simDecay} onChange={(e) => setSimDecay(Number(e.target.value))} className={inputCls + ' ml-2 w-20'} />
          </label>
          <button onClick={runSim} className={btnCls}>Lancer</button>
        </div>
        {simResult && <SimTable result={simResult} />}
      </details>
    </div>
  )
}
