/**
 * Helpers pour les réponses stub des routes non encore migrées vers MariaDB.
 * Ces routes retournent des données minimales valides pour éviter les 501.
 */
import { NextResponse } from 'next/server'

export function stubRequireAuth(req: { headers: { get: (k: string) => string | null } }): string | NextResponse {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }
  return auth.slice(7)
}

export const stubResponses = {
  prairie: {
    fleurs: () => NextResponse.json({ fleurs: [], links: [] }),
  },
  social: {
    visitLisiere: () =>
      NextResponse.json({
        pseudo: '',
        echoInflorescence: '',
        fleurMoyenne: { petals: [] },
      }),
    sendSeed: () => NextResponse.json({ ok: true, seed_id: 0 }),
    acceptConnection: () => NextResponse.json({ ok: true }),
    myChannels: () => NextResponse.json({ channels: [] }),
    channelMessages: () => NextResponse.json({ messages: [] }),
    sendMessage: () => NextResponse.json({ ok: true }),
    presenceHeartbeat: () => NextResponse.json({ ok: true, meteoPetal: null, socialMode: 'open' }),
  },
  sessions: {
    list: () => NextResponse.json({ items: [], total: 0 }),
    stats: () => NextResponse.json({ total: 0, by_status: {} }),
    shadowStats: () => NextResponse.json({ total: 0, by_level: {} }),
  },
  analytics: () => NextResponse.json({ overview: {} }),
  users: {
    suivi: () => NextResponse.json({ items: [] }),
    suiviDetail: () => NextResponse.json({}),
  },
  tarot: {
    save: () => NextResponse.json({ id: 0 }),
    stats: () => NextResponse.json({ total: 0 }),
    my: () => NextResponse.json({ items: [] }),
    list: () => NextResponse.json({ items: [], total: 0 }),
    get: () => NextResponse.json({}),
    update: () => NextResponse.json({ ok: true }),
    delete: () => NextResponse.json({ ok: true }),
  },
  translate: () => NextResponse.json({ translatedText: '' }),
}
