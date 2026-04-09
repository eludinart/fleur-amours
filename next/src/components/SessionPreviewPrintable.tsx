'use client'

import { FlowerSVG } from '@/components/FlowerSVG'
import { proxyImageUrl } from '@/lib/api-client'

type CardLike = { name?: string; img?: string } | null | undefined

export function SessionPreviewPrintable(props: {
  title?: string
  createdAt?: string
  appName?: string
  appUrl?: string
  petals?: Record<string, number>
  drawnCards?: Array<{ door?: string; card?: CardLike }>
  anchors?: Array<{ subtitle?: string; synthesis?: string; habit?: string }>
  plan14j?: any
}) {
  const {
    title = "Exploration de Ma Fleur d'Amours",
    createdAt,
    appName = "Fleur d'AmOurs — Tarot Fleur d'Amours",
    appUrl = '',
    petals = {},
    drawnCards = [],
    anchors = [],
    plan14j = null,
  } = props

  const hasPetals = petals && typeof petals === 'object' && Object.keys(petals).length > 0
  const cards = Array.isArray(drawnCards) ? drawnCards.filter(Boolean) : []

  return (
    <div
      data-pdf-root="sessionPreview"
      style={{
        width: 794,
        padding: 48,
        background: '#ffffff',
        color: '#000000',
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
        lineHeight: 1.35,
      }}
    >
      <style>{`
        [data-pdf-root="sessionPreview"] h1 { font-size: 28px; margin: 0 0 6px; font-weight: 800; }
        [data-pdf-root="sessionPreview"] h2 { font-size: 18px; margin: 22px 0 10px; font-weight: 800; }
        [data-pdf-root="sessionPreview"] h3 { font-size: 14px; margin: 14px 0 6px; font-weight: 800; }
        [data-pdf-root="sessionPreview"] p { margin: 0 0 8px; font-size: 12px; }
        [data-pdf-root="sessionPreview"] .muted { color: #4b5563; }
        [data-pdf-root="sessionPreview"] .small { font-size: 11px; }
        [data-pdf-root="sessionPreview"] .hr { height: 1px; background: #e5e7eb; margin: 16px 0; }
        [data-pdf-root="sessionPreview"] img, [data-pdf-root="sessionPreview"] svg { display: block; margin: 0 auto; }
        [data-pdf-root="sessionPreview"] .flower-svg { overflow: visible !important; }
        [data-pdf-root="sessionPreview"] .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
        [data-pdf-root="sessionPreview"] .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px; text-align: center; }
        [data-pdf-root="sessionPreview"] .card img { max-width: 100%; height: 120px; object-fit: contain; }
        [data-pdf-root="sessionPreview"] .box { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; }
        [data-pdf-root="sessionPreview"] .pdf-page-break { break-before: page; page-break-before: always; }
        [data-pdf-root="sessionPreview"] .day { border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; margin: 10px 0; }
        [data-pdf-root="sessionPreview"] ul { margin: 8px 0 0 18px; padding: 0; }
        [data-pdf-root="sessionPreview"] li { margin: 0 0 6px; font-size: 12px; }
        [data-pdf-root="sessionPreview"] .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e5e7eb; }
        /* Pagination helpers (html2pdf/html2canvas) */
        [data-pdf-root="sessionPreview"] .day { break-inside: avoid; page-break-inside: avoid; }
        [data-pdf-root="sessionPreview"] h2, [data-pdf-root="sessionPreview"] h3 { break-after: avoid; page-break-after: avoid; }
        @media print {
          [data-pdf-root="sessionPreview"] { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <h1>{title}</h1>
      <p className="muted small">{appName}</p>
      <p className="muted small">
        {createdAt ? `Date : ${new Date(createdAt).toLocaleString('fr-FR')}` : null}
        {createdAt && appUrl ? ' · ' : null}
        {appUrl ? appUrl : null}
      </p>

      <div className="pdf-avoid-break" style={{ marginTop: 18 }}>
        {hasPetals ? (
          <div
            style={{
              width: 520,
              marginLeft: 'auto',
              marginRight: 'auto',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <FlowerSVG petals={petals} size={520} animate={false} showLabels={true} showScores={false} />
          </div>
        ) : (
          <p className="muted">Aucune donnée de fleur.</p>
        )}
      </div>

      <div className="hr" />

      {cards.length > 0 && (
        <>
          <h2>Cartes tirées</h2>
          <div className="grid pdf-avoid-break">
            {cards.slice(0, 12).map((d, i) => (
              <div key={i} className="card pdf-avoid-break">
                {d?.card?.img ? (
                  <img src={proxyImageUrl(d.card.img) ?? d.card.img} alt={d.card.name || 'Carte'} />
                ) : null}
                <p style={{ fontWeight: 700, marginTop: 8 }}>{d?.card?.name || '—'}</p>
                {d?.door ? <p className="muted small">{d.door}</p> : null}
              </div>
            ))}
          </div>
          {cards.length > 12 ? <p className="muted small">+ {cards.length - 12} autres cartes…</p> : null}
        </>
      )}

      {anchors.length > 0 && (
        <>
          <h2>Ancres</h2>
          <div className="box">
            {anchors.map((a, i) => (
              <div key={i} className="pdf-avoid-break" style={{ marginBottom: 10 }}>
                <h3 style={{ margin: '0 0 4px' }}>{a.subtitle || `Ancre ${i + 1}`}</h3>
                {a.synthesis ? <p style={{ fontStyle: 'italic' }}>&quot;{a.synthesis}&quot;</p> : null}
                {a.habit ? <p className="muted small">Habitude : {a.habit}</p> : null}
              </div>
            ))}
          </div>
        </>
      )}

      {plan14j && (
        <div className="pdf-page-break">
          <h2>Plan 14 jours</h2>

          {(plan14j?.synthesis || plan14j?.synthesis_suggestion) && (
            <>
              <h3>Phrase-synthèse</h3>
              <div className="box pdf-avoid-break">
                <p style={{ fontStyle: 'italic' }}>
                  {plan14j?.synthesis || plan14j?.synthesis_suggestion}
                </p>
              </div>
            </>
          )}

          {Array.isArray(plan14j?.levers) && plan14j.levers.length > 0 && (
            <>
              <h3>Micro-leviers</h3>
              <ul>
                {plan14j.levers.map((lever: string, i: number) => {
                  const [action, anchor] = String(lever).split('||ANCHOR||')
                  return (
                    <li key={i} className="pdf-avoid-break">
                      <strong>{(action || '').trim() || lever}</strong>
                      {String(anchor || '').trim() ? <span className="muted"> — ancré dans {String(anchor).trim()}</span> : null}
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          {Array.isArray(plan14j?.plan_14j) && plan14j.plan_14j.length > 0 ? (
            <>
              <h3>Jours</h3>
              {plan14j.plan_14j.map((d: any, idx: number) => (
                <div key={d?.day ?? idx} className="day pdf-avoid-break">
                  <h3 style={{ marginTop: 0 }}>
                    Jour {d?.day ?? idx + 1}{d?.theme ? ` — ${d.theme}` : ''}
                  </h3>
                  {d?.action ? <p>{d.action}</p> : null}
                  {d?.context ? <p className="muted small">{d.context}</p> : null}
                </div>
              ))}
            </>
          ) : (
            <p className="muted">Plan indisponible.</p>
          )}
        </div>
      )}

      <div className="footer muted small">
        <p className="small muted">
          {appName}
          {appUrl ? ` — ${appUrl}` : ''}
        </p>
        <p className="small muted">
          Document généré automatiquement{createdAt ? ` · ${new Date(createdAt).toLocaleDateString('fr-FR')}` : ''}.
        </p>
      </div>
    </div>
  )
}

