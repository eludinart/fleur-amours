/**
 * GET /api/og/tirage?id=…
 * Carte Open Graph 1200×627 — tirage tarot (spec LinkedIn) + preuve + CTA.
 */
import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { getById } from '@/lib/db-tarot'
import {
  OG_TAROT_CHIPS_4,
  OG_TAROT_CHIPS_SIMPLE,
  OG_TAROT_CTA,
  OG_TAROT_FOOTER_MICRO,
  OG_TAROT_HOOK_4,
  OG_TAROT_HOOK_SIMPLE,
  OG_TAROT_KICKER_4,
  OG_TAROT_KICKER_SHARED,
  OG_TAROT_KICKER_SIMPLE,
  OG_TAROT_SUB,
  OG_CHIP_FAST,
  OG_CHIP_FREE,
  OG_CHIP_PRIVATE,
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
const H = 627

function absoluteCardImageUrl(img: string | null | undefined, req: NextRequest): string | undefined {
  if (!img?.trim()) return undefined
  const u = img.trim()
  if (/^https?:\/\//i.test(u)) return u
  const origin = req.nextUrl.origin
  const path = u.startsWith('/') ? u : `/${u}`
  return `${origin}${path}`
}

function truncate(s: string | null | undefined, max: number): string {
  if (!s) return ''
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')

  let reading: Record<string, unknown> | null = null
  if (id && !isNaN(Number(id)) && isDbConfigured()) {
    try {
      reading = await getById(Number(id))
    } catch {
      /* fallback */
    }
  }

  const type = (reading?.type as string) || 'simple'
  const isSimple = type === 'simple'
  const card = reading?.card as { name?: string; synth?: string; img?: string } | undefined
  const cards = reading?.cards as Array<{ name?: string; synth?: string; img?: string }> | undefined
  const synthesis4 = (reading?.synthesis as string) || ''

  const cardName = isSimple
    ? card?.name || 'Votre carte'
    : cards?.map((c) => c.name).join(' · ') || 'Les quatre portes'
  const cardSynth = isSimple ? card?.synth : synthesis4
  const cardImgRaw = isSimple ? card?.img : null
  const cardImg = absoluteCardImageUrl(cardImgRaw, req)

  const hasReading = Boolean(reading)
  const kicker = hasReading
    ? OG_TAROT_KICKER_SHARED
    : isSimple
      ? OG_TAROT_KICKER_SIMPLE
      : OG_TAROT_KICKER_4
  const hook = isSimple ? OG_TAROT_HOOK_SIMPLE : OG_TAROT_HOOK_4
  const chips = isSimple ? OG_TAROT_CHIPS_SIMPLE : OG_TAROT_CHIPS_4
  const trustChips = [OG_CHIP_FREE, OG_CHIP_PRIVATE, OG_CHIP_FAST] as const

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: W,
          height: H,
          background: 'linear-gradient(148deg, #020617 0%, #1e1b4b 48%, #0f172a 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -100,
            right: -60,
            width: 480,
            height: 480,
            borderRadius: '50%',
            background: 'rgba(99,102,241,0.2)',
            filter: 'blur(88px)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            left: 40,
            width: 340,
            height: 340,
            borderRadius: '50%',
            background: 'rgba(236,72,153,0.11)',
            filter: 'blur(70px)',
            display: 'flex',
          }}
        />

        <OgBrandHeader variant="dark" />

        <div
          style={{
            position: 'absolute',
            top: 92,
            right: 44,
            display: 'flex',
            alignItems: 'center',
            padding: '8px 16px',
            borderRadius: 999,
            background: 'linear-gradient(125deg, rgba(250,204,21,0.22) 0%, rgba(244,114,182,0.18) 100%)',
            border: '1px solid rgba(250,204,21,0.45)',
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.14em',
            color: '#fef9c3',
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            textTransform: 'uppercase',
            boxShadow: '0 4px 24px rgba(250,204,21,0.15)',
          }}
        >
          Gratuit
        </div>

        {isSimple ? (
          <div style={{ display: 'flex', flex: 1, padding: '108px 0 76px', boxSizing: 'border-box' }}>
            <div
              style={{
                display: 'flex',
                width: 348,
                alignItems: 'center',
                justifyContent: 'center',
                paddingLeft: 48,
                paddingRight: 20,
              }}
            >
              {cardImg ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={cardImg}
                  width={236}
                  height={378}
                  style={{
                    borderRadius: 20,
                    objectFit: 'contain',
                    boxShadow:
                      '0 0 72px rgba(139,92,246,0.6), 0 0 0 1px rgba(250,250,250,0.08), 0 16px 48px rgba(0,0,0,0.5)',
                    border: '1px solid rgba(167,139,250,0.4)',
                  }}
                  alt={cardName}
                />
              ) : (
                <div
                  style={{
                    width: 236,
                    height: 378,
                    borderRadius: 20,
                    background: 'linear-gradient(160deg, rgba(76,29,149,0.5) 0%, rgba(30,27,75,0.85) 100%)',
                    border: '1px solid rgba(139,92,246,0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 58,
                  }}
                >
                  ✿
                </div>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                justifyContent: 'center',
                paddingRight: 52,
                paddingLeft: 4,
              }}
            >
              <OgKicker variant="dark">{kicker}</OgKicker>

              <div
                style={{
                  fontSize: 50,
                  fontWeight: 800,
                  color: '#f8fafc',
                  lineHeight: 1.06,
                  marginBottom: 14,
                  letterSpacing: '-0.035em',
                  fontFamily:
                    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  display: 'flex',
                }}
              >
                {truncate(cardName, 28)}
              </div>

              {cardSynth && (
                <div
                  style={{
                    fontSize: 19,
                    color: 'rgba(248,250,252,0.92)',
                    lineHeight: 1.48,
                    marginBottom: 16,
                    fontFamily: 'Georgia, "Times New Roman", serif',
                    fontStyle: 'italic',
                    display: 'flex',
                    borderLeft: '4px solid rgba(167,139,250,0.85)',
                    paddingLeft: 18,
                  }}
                >
                  {truncate(cardSynth, 100)}
                </div>
              )}

              <OgHook variant="dark" size="md">
                {hook}
              </OgHook>
              <OgSubhook variant="dark">{OG_TAROT_SUB}</OgSubhook>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <OgBenefitChips items={chips} variant="dark" />
                <OgBenefitChips items={trustChips} variant="dark" />
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              padding: '108px 52px 76px',
              boxSizing: 'border-box',
              justifyContent: 'center',
              gap: 18,
            }}
          >
            <OgKicker variant="dark">{kicker}</OgKicker>
            <OgHook variant="dark" size="md">
              {hook}
            </OgHook>
            <OgSubhook variant="dark">{OG_TAROT_SUB}</OgSubhook>

            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 8 }}>
              {(cards || []).slice(0, 4).map((c, i) => {
                const absDoorImg = absoluteCardImageUrl(c.img, req)
                return (
                <div
                  key={i}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
                >
                  {absDoorImg ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={absDoorImg}
                      width={132}
                      height={198}
                      style={{
                        borderRadius: 12,
                        objectFit: 'contain',
                        boxShadow: '0 0 28px rgba(139,92,246,0.45)',
                        border: '1px solid rgba(167,139,250,0.25)',
                      }}
                      alt={c.name || ''}
                    />
                  ) : (
                    <div
                      style={{
                        width: 132,
                        height: 198,
                        borderRadius: 12,
                        background: 'rgba(76,29,149,0.35)',
                        border: '1px solid rgba(139,92,246,0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 36,
                      }}
                    >
                      ✿
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'rgba(226,232,240,0.88)',
                      textAlign: 'center',
                      maxWidth: 132,
                      fontFamily:
                        'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                    }}
                  >
                    {truncate(c.name, 20)}
                  </div>
                </div>
                )
              })}
            </div>

            {cardName && (
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: 'rgba(248,250,252,0.92)',
                  fontFamily:
                    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}
              >
                {truncate(cardName, 52)}
              </div>
            )}

            {synthesis4 && (
              <div
                style={{
                  fontSize: 17,
                  color: 'rgba(226,232,240,0.86)',
                  lineHeight: 1.48,
                  fontStyle: 'italic',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  borderLeft: '3px solid rgba(167,139,250,0.7)',
                  paddingLeft: 14,
                }}
              >
                {truncate(synthesis4, 132)}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <OgBenefitChips items={chips} variant="dark" />
              <OgBenefitChips items={trustChips} variant="dark" />
            </div>
          </div>
        )}

        <OgConversionFooter
          ctaLabel={OG_TAROT_CTA}
          variant="dark"
          leftHint={OG_TAROT_FOOTER_MICRO}
        />
      </div>
    ),
    {
      width: W,
      height: H,
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'Content-Disposition': 'inline; filename="og-tirage.png"',
      },
    }
  )
}
