/**
 * POST /api/auth/logout — Efface le cookie d'authentification httpOnly.
 * Pas d'auth requise (on efface le cookie même si expiré).
 */
import { NextRequest, NextResponse } from 'next/server'
import { clearAuthCookie } from '@/lib/auth-cookie'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest) {
  const res = NextResponse.json({ ok: true })
  clearAuthCookie(res)
  return res
}
