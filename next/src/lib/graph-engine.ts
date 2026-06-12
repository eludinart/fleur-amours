/**
 * Graphe de co-occurrence par tags partagés + simulation de diffusion.
 */
import { extractCardTags, listCards } from './cards-data'

export type GraphNode = { id: string; label: string }
export type GraphEdge = { source: string; target: string; weight: number; tags: string[] }
export type GraphData = { nodes: GraphNode[]; edges: GraphEdge[] }

export async function buildCardGraph(minShared = 1): Promise<GraphData> {
  const cards = await listCards()
  const tagged = cards.map((c) => ({
    slug: String(c.slug ?? '').trim(),
    label: String(c.name ?? c.slug ?? '').trim(),
    tags: extractCardTags(c),
  })).filter((c) => c.slug)

  const nodes: GraphNode[] = tagged.map((c) => ({ id: c.slug, label: c.label }))
  const edges: GraphEdge[] = []

  for (let i = 0; i < tagged.length; i++) {
    for (let j = i + 1; j < tagged.length; j++) {
      const a = tagged[i]
      const b = tagged[j]
      const shared = a.tags.filter((t) => b.tags.includes(t))
      if (shared.length >= Math.max(1, minShared)) {
        edges.push({
          source: a.slug,
          target: b.slug,
          weight: shared.length,
          tags: shared,
        })
      }
    }
  }
  return { nodes, edges }
}

export async function simulateGraphDiffusion(params: {
  seeds: string[]
  steps?: number
  decay?: number
}): Promise<{ slugs: string[]; timeline: Array<Record<string, number>> }> {
  const steps = Math.min(20, Math.max(1, Number(params.steps ?? 6)))
  const decay = Math.min(0.99, Math.max(0.01, Number(params.decay ?? 0.6)))
  const graph = await buildCardGraph(1)
  const slugs = graph.nodes.map((n) => n.id)
  const state: Record<string, number> = Object.fromEntries(slugs.map((s) => [s, 0]))
  for (const seed of params.seeds) {
    const k = seed.trim().toLowerCase().replace(/-/g, '_')
    const match = slugs.find((s) => s === k || s === seed) ?? k
    if (match in state) state[match] = 1
  }

  const timeline: Array<Record<string, number>> = [Object.fromEntries(slugs.map((s) => [s, state[s]]))]
  const adj = new Map<string, Array<{ other: string; weight: number }>>()
  for (const e of graph.edges) {
    if (!adj.has(e.source)) adj.set(e.source, [])
    if (!adj.has(e.target)) adj.set(e.target, [])
    adj.get(e.source)!.push({ other: e.target, weight: e.weight })
    adj.get(e.target)!.push({ other: e.source, weight: e.weight })
  }

  for (let step = 0; step < steps; step++) {
    const next: Record<string, number> = {}
    for (const slug of slugs) {
      next[slug] = state[slug] * decay
    }
    for (const slug of slugs) {
      const neighbors = adj.get(slug) ?? []
      const totalW = neighbors.reduce((s, n) => s + n.weight, 0) || 1
      for (const n of neighbors) {
        const transfer = state[slug] * (1 - decay) * (n.weight / totalW)
        next[n.other] = (next[n.other] ?? 0) + transfer
      }
    }
    for (const slug of slugs) state[slug] = next[slug] ?? 0
    timeline.push(Object.fromEntries(slugs.map((s) => [s, state[s]])))
  }

  return { slugs, timeline }
}
