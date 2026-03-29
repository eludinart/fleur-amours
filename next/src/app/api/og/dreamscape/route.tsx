/**
 * GET /api/og/dreamscape?token=…
 * Carte Open Graph 1200×630 — conversion : promesse, sens, CTA.
 */
import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { getShared } from '@/lib/db-dreamscape'
import {
  OG_DREAMSCAPE_CHIPS,
  OG_DREAMSCAPE_CTA,
  OG_DREAMSCAPE_HOOK,
  OG_DREAMSCAPE_KICKER,
  OG_DREAMSCAPE_FALLBACK_TITLE,
  OG_DREAMSCAPE_SUB,
} from '@/lib/og-share-copy'
import {
  OgBenefitChips,
  OgBrandHeader,
  OgConversionFooter,
  OgHook,
  OgKicker,
  OgSubhook,
} from '@/lib/og-share-chrome'

export const dynamic = 'force-dynamic'

const W = 1200
const H = 630

function truncate(s: string | null | undefined, max: number): string {
  if (!s) return ''
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  let snapshot: string | null = null
  let poeticReflection: string | null = null

  if (token && isDbConfigured()) {
    try {
      const data = await getShared(token)
      snapshot = (data.snapshot as string) || null
      poeticReflection = (data.poeticReflection as string) || null
      if (!poeticReflection) {
        const history = (data.history as Array<{ role?: string; content?: string }>) || []
        const closing = history.find((m) => m.role === 'closing')
        poeticReflection = closing?.content || null
      }
    } catch {
      /* fallback */
    }
  }

  const excerpt = truncate(poeticReflection, 138)

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: W,
          height: H,
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(145deg, #05010a 0%, #120822 42%, #1a0a28 100%)',
        }}
      >
        {snapshot && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={snapshot}
            width={W}
            height={H}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: W,
              height: H,
              objectFit: 'cover',
              opacity: 0.52,
            }}
            alt=""
          />
        )}

        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: snapshot
              ? 'radial-gradient(ellipse 80% 70% at 50% 100%, rgba(10,2,24,0.15) 0%, rgba(5,1,12,0.88) 55%, rgba(3,0,10,0.97) 100%)'
              : 'radial-gradient(ellipse 120% 80% at 20% 20%, rgba(124,58,237,0.12) 0%, transparent 50%)',
            display: 'flex',
          }}
        />

        <div
          style={{
            position: 'absolute',
            top: -100,
            right: -80,
            width: 420,
            height: 420,
            borderRadius: '50%',
            background: 'rgba(139,92,246,0.14)',
            filter: 'blur(90px)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 120,
            left: -60,
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: 'rgba(219,39,119,0.1)',
            filter: 'blur(72px)',
            display: 'flex',
          }}
        />

        <OgBrandHeader variant="dark" />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            width: '100%',
            height: '100%',
            padding: '118px 56px 92px',
            position: 'relative',
            boxSizing: 'border-box',
          }}
        >
          <OgKicker variant="dark">{OG_DREAMSCAPE_KICKER}</OgKicker>
          <OgHook variant="dark">{OG_DREAMSCAPE_HOOK}</OgHook>
          <OgSubhook variant="dark">{OG_DREAMSCAPE_SUB}</OgSubhook>

          {excerpt ? (
            <div
              style={{
                fontSize: 22,
                fontWeight: 400,
                color: 'rgba(255,252,255,0.92)',
                lineHeight: 1.5,
                fontStyle: 'italic',
                fontFamily: 'Georgia, "Times New Roman", serif',
                marginBottom: 18,
                display: 'flex',
                borderLeft: '4px solid rgba(167,139,250,0.75)',
                paddingLeft: 20,
              }}
            >
              « {excerpt} »
            </div>
          ) : (
            <div
              style={{
                fontSize: 26,
                fontWeight: 600,
                color: 'rgba(248,250,252,0.9)',
                lineHeight: 1.35,
                marginBottom: 18,
                fontFamily:
                  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                display: 'flex',
              }}
            >
              {OG_DREAMSCAPE_FALLBACK_TITLE}
            </div>
          )}

          <OgBenefitChips items={OG_DREAMSCAPE_CHIPS} variant="dark" />
        </div>

        <OgConversionFooter ctaLabel={OG_DREAMSCAPE_CTA} variant="dark" />
      </div>
    ),
    { width: W, height: H }
  )
}
