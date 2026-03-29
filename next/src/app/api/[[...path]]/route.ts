/**
 * Catch-all pour les routes API.
 * En développement : retourne des stubs JSON pour les routes connues sans handler,
 *   et un 404 explicite pour toute route inconnue.
 * En production : 404 systématique (les stubs ne doivent pas être exposés).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthHeader } from '@/lib/api-auth'
import { jwtDecode } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

const IS_PROD = process.env.NODE_ENV === 'production'

const STUB_RESPONSES: Record<string, unknown> = {
  'notifications/list': { items: [], total: 0 },
  'notifications/unread_count': { unread: 0, count: 0 },
  'notifications/mark_read': { ok: true },
  'notifications/mark_all_read': { ok: true },
  'notifications/delete_read': { ok: true },
  'notifications/preferences': { preferences: {} },
  'notifications/stats': { total: 0 },
  'notifications/ensure_tables': { ok: true },
  'notifications/create': { ok: true },
  'notifications/test': { ok: true },
  'notifications/register_push_token': { ok: true },
  'notifications/admin_list': { items: [], total: 0 },
  'notifications/admin_delete': { ok: true },
  'chat/conversations/start': { id: '0', status: 'open', closed_by_role: null },
  'chat/conversations/my': {
    conversations: [],
  },
  'chat/conversations/list': { conversations: [], total: 0 },
  'chat/conversations/close': { ok: true },
  'chat/conversations/delete': { ok: true },
  'chat/messages': { items: [], assigned_coach_id: null, status: 'open', closed_by_role: null },
  'chat/send': null, // traité spécialement en POST avec le body
  'chat/mark_read': { ok: true },
  'chat/unread': { count: 0 },
  'chat/stats': { total: 0 },
  'contact_messages/save': { id: 0 },
  'contact_messages/stats': { total: 0 },
  'contact_messages/list': { items: [], total: 0 },
  'contact_messages/get': {},
  'contact_messages/update': { ok: true },
  'stats/overview': { overview: {} },
  'stats/averages': { averages: {} },
  'stats/results': { items: [], total: 0 },
  'campaigns': { campaigns: [], total: 0 },
  'campaigns/definitions': { definitions: [] },
  'cards': { cards: [] },
  'cards/import': { ok: true },
  'files': { files: [] },
  'invariants': { invariants: [] },
  'sap/deduct': { ok: true },
  'sap/preview': { cost: 0 },
  'user/access': { access: {} },
  'promo/redeem': { ok: true },
  'billing/products': { products: [] },
  'billing/create-checkout-session': { url: '' },
  'promo/codes': { codes: [] },
  'promo/codes/create': { ok: true },
  'promo/codes/update': { ok: true },
  'promo/codes/delete': { ok: true },
  'promo/redemptions': { items: [] },
  'promo/user-redemptions': { items: [] },
  'promo/admin-assign': { ok: true },
  'promo/remove-redemption': { ok: true },
  'admin/user-usage': {},
  'admin/credit-usage': { ok: true },
  'admin/credit-sap': { ok: true },
  'wp/status': { ok: true },
  'wp/posts': { posts: [] },
  'wp/pages': { pages: [] },
  'diagnostic': { ok: true },
  'graph': { nodes: [], edges: [] },
  'simulate': { result: {} },
}

function getStubResponse(path: string): unknown {
  const normalized = (path || '')
    .replace(/^\/jardin\/api\/?/, '')
    .replace(/^\/api\/?/, '')
    .replace(/^\/+|\/+$/g, '')
  // campaigns/:id/results (before generic campaigns match)
  if (/^campaigns\/\d+\/results$/.test(normalized)) return { results: [] }
  const campaignMatch = normalized.match(/^campaigns\/(\d+)$/)
  if (campaignMatch) {
    const id = parseInt(campaignMatch[1], 10)
    return { id, definition_id: 1, participant_count: 0, result_count: 0, status: 'draft', created_at: new Date().toISOString(), participants: [] }
  }
  // fleur, duo (before generic match)
  if (normalized.includes('fleur/') || normalized.includes('duo/')) {
    if (normalized.includes('questions/')) return []
    if (normalized.includes('my-results')) return { items: [] }
    if (normalized.includes('result/') || normalized.includes('duo-result/')) return { id: 0, scores: {}, analysis: '', composite: { coherence_index: 0, vitality_index: 0, stability_index: 0 }, interpretation: null }
    if (normalized.includes('answers/')) return []
    if (normalized.includes('stats/')) return { count: 0, by_dimension: {} }
    if (normalized.includes('submit') || normalized.includes('duo-explanation')) return { id: 0, scores: {}, analysis: '', composite: { coherence_index: 0, vitality_index: 0, stability_index: 0 }, interpretation: null }
    if (normalized.includes('duo/invite')) return { ok: true }
    if (normalized.includes('fleur/delete')) return { ok: true }
    return {}
  }
  for (const [key, value] of Object.entries(STUB_RESPONSES)) {
    if (normalized === key || normalized.endsWith('/' + key) || normalized.startsWith(key + '/')) {
      return value
    }
  }
  if (normalized.includes('science/')) return { files: [] }
  return null
}

function notFound(path: string) {
  return NextResponse.json(
    { error: `Route non implémentée : ${path}` },
    { status: 404 }
  )
}

export async function GET(req: NextRequest) {
  if (IS_PROD) return notFound(req.nextUrl.pathname)
  const stub = getStubResponse(req.nextUrl.pathname)
  if (stub === null) return notFound(req.nextUrl.pathname)
  return NextResponse.json(stub)
}

export async function POST(req: NextRequest) {
  if (IS_PROD) return notFound(req.nextUrl.pathname)

  const path = req.nextUrl.pathname || ''
  const normalized = path
    .replace(/^\/jardin\/api\/?/, '')
    .replace(/^\/api\/?/, '')
    .replace(/^\/+|\/+$/g, '')

  // chat/send : vérifie l'authentification avant de renvoyer le stub.
  if (normalized === 'chat/send' || normalized.endsWith('/chat/send')) {
    const token = getAuthHeader(req)
    const payload = token ? jwtDecode(token) : null
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
    }
    let body: { conversation_id?: string; content?: string; sender_role?: string } = {}
    try {
      body = (await req.json()) as typeof body
    } catch { /* ignore */ }
    const msg = {
      id: `stub-${Date.now()}`,
      conversation_id: body?.conversation_id ?? '0',
      sender_role: body?.sender_role ?? 'user',
      content: String(body?.content ?? '').trim() || '(message vide)',
      created_at: new Date().toISOString(),
    }
    return NextResponse.json(msg, { status: 201 })
  }

  const stub = getStubResponse(path)
  if (stub === null) return notFound(path)
  return NextResponse.json(stub)
}

export async function PUT(req: NextRequest) {
  if (IS_PROD) return notFound(req.nextUrl.pathname)
  const stub = getStubResponse(req.nextUrl.pathname)
  if (stub === null) return notFound(req.nextUrl.pathname)
  return NextResponse.json(stub)
}

export async function PATCH(req: NextRequest) {
  if (IS_PROD) return notFound(req.nextUrl.pathname)
  const stub = getStubResponse(req.nextUrl.pathname)
  if (stub === null) return notFound(req.nextUrl.pathname)
  return NextResponse.json(stub)
}

export async function DELETE(req: NextRequest) {
  if (IS_PROD) return notFound(req.nextUrl.pathname)
  const stub = getStubResponse(req.nextUrl.pathname)
  if (stub === null) return notFound(req.nextUrl.pathname)
  return NextResponse.json(stub)
}
