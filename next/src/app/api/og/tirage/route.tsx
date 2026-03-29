/**
 * GET /api/og/tirage?id=…
 * Génère une image OG 1200×630 pour un tirage tarot.
 * Utilisée comme og:image et twitter:image pour les previews sociaux.
 */
import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { getById } from '@/lib/db-tarot'

export const dynamic = 'force-dynamic'

const W = 1200
const H = 630

const BRAND = "Fleur d'AmOurs"
const CTA = 'Faire mon propre tirage →'

function truncate(s: string | null | undefined, max: number): string {
  if (!s) return ''
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

function TypeBadge({ label }: { label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(139,92,246,0.2)',
        border: '1px solid rgba(139,92,246,0.4)',
        borderRadius: '999px',
        padding: '4px 14px',
        fontSize: 14,
        color: 'rgba(196,181,253,0.95)',
        letterSpacing: '2px',
        textTransform: 'uppercase',
        marginBottom: 20,
      }}
    >
      {label}
    </div>
  )
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')

  // Default fallback image when no DB or no reading
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
  const intention = reading?.intention as string | undefined

  const cardName = isSimple ? (card?.name || 'Fleur d\'AmOurs') : (cards?.map((c) => c.name).join(' · ') || '4 Portes')
  const cardSynth = isSimple ? card?.synth : (reading?.synthesis as string | undefined)
  const cardImg = isSimple ? card?.img : null
  const typeLabel = isSimple ? 'Tirage Simple' : 'Tirage 4 Portes'

  const bgGradient = 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #0f172a 100%)'

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: W,
          height: H,
          background: bgGradient,
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Decorative blur circles */}
        <div
          style={{
            position: 'absolute',
            top: -120,
            right: -100,
            width: 450,
            height: 450,
            borderRadius: '50%',
            background: 'rgba(99,102,241,0.18)',
            filter: 'blur(80px)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -80,
            left: 200,
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'rgba(236,72,153,0.1)',
            filter: 'blur(60px)',
            display: 'flex',
          }}
        />

        {isSimple ? (
          /* ─── SIMPLE: image gauche + texte droite ─── */
          <div style={{ display: 'flex', flex: 1, padding: '50px 0' }}>
            {/* Card image */}
            <div
              style={{
                display: 'flex',
                width: 380,
                alignItems: 'center',
                justifyContent: 'center',
                paddingLeft: 60,
                paddingRight: 30,
              }}
            >
              {cardImg ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={cardImg}
                  width={200}
                  height={320}
                  style={{
                    borderRadius: 16,
                    objectFit: 'contain',
                    boxShadow: '0 0 50px rgba(139,92,246,0.55), 0 0 20px rgba(139,92,246,0.3)',
                  }}
                  alt={cardName}
                />
              ) : (
                <div
                  style={{
                    width: 200,
                    height: 320,
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, rgba(139,92,246,0.3) 0%, rgba(99,102,241,0.2) 100%)',
                    border: '1px solid rgba(139,92,246,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 48,
                  }}
                >
                  🌸
                </div>
              )}
            </div>

            {/* Text */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                justifyContent: 'center',
                paddingRight: 60,
                paddingLeft: 10,
              }}
            >
              <TypeBadge label={typeLabel} />
              <div
                style={{
                  fontSize: 54,
                  fontWeight: 800,
                  color: 'white',
                  lineHeight: 1.08,
                  marginBottom: 20,
                  letterSpacing: '-1px',
                }}
              >
                {truncate(cardName, 28)}
              </div>
              {cardSynth && (
                <div
                  style={{
                    fontSize: 19,
                    color: 'rgba(203,213,225,0.88)',
                    lineHeight: 1.55,
                    marginBottom: 24,
                  }}
                >
                  {truncate(cardSynth, 110)}
                </div>
              )}
              {intention && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    fontSize: 16,
                    color: 'rgba(196,181,253,0.82)',
                    fontStyle: 'italic',
                    borderLeft: '3px solid rgba(139,92,246,0.5)',
                    paddingLeft: 14,
                  }}
                >
                  {truncate(intention, 80)}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ─── QUATRE PORTES: grille de cartes + synthèse ─── */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              padding: '42px 60px',
              justifyContent: 'center',
              gap: 28,
            }}
          >
            <TypeBadge label={typeLabel} />
            {/* 4 card images */}
            <div style={{ display: 'flex', gap: 18, alignItems: 'flex-end', marginBottom: 4 }}>
              {(cards || []).slice(0, 4).map((c, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  {c.img ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={c.img}
                      width={140}
                      height={210}
                      style={{
                        borderRadius: 10,
                        objectFit: 'contain',
                        boxShadow: '0 0 25px rgba(139,92,246,0.4)',
                      }}
                      alt={c.name || ''}
                    />
                  ) : (
                    <div
                      style={{
                        width: 140,
                        height: 210,
                        borderRadius: 10,
                        background: 'rgba(139,92,246,0.2)',
                        border: '1px solid rgba(139,92,246,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 32,
                      }}
                    >
                      🃏
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: 13,
                      color: 'rgba(196,181,253,0.9)',
                      textAlign: 'center',
                      maxWidth: 140,
                      overflow: 'hidden',
                    }}
                  >
                    {truncate(c.name, 18)}
                  </div>
                </div>
              ))}
            </div>
            {intention && (
              <div
                style={{
                  fontSize: 17,
                  color: 'rgba(196,181,253,0.82)',
                  fontStyle: 'italic',
                  borderLeft: '3px solid rgba(139,92,246,0.5)',
                  paddingLeft: 14,
                }}
              >
                {truncate(intention, 90)}
              </div>
            )}
          </div>
        )}

        {/* Footer bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 64,
            background: 'rgba(0,0,0,0.55)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 56px',
          }}
        >
          <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', gap: 8 }}>
            🌸 <span>{BRAND}</span>
          </div>
          <div
            style={{
              fontSize: 16,
              color: 'rgba(196,181,253,0.9)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {CTA}
          </div>
        </div>
      </div>
    ),
    { width: W, height: H }
  )
}
