'use client'

import { FlowerSVG } from '@/components/FlowerSVG'

type Anchor = { subtitle?: string; synthesis?: string; habit?: string }
type Day = { day?: number; theme?: string; action?: string; context?: string }

export function Plan14jPrintable(props: {
  petals: Record<string, number>
  petalsDeficit?: Record<string, number>
  petalsEvolution?: unknown
  plan: any
  anchors?: Anchor[]
}) {
  const { petals, petalsDeficit = {}, plan, anchors = [] } = props

  const days: Day[] = Array.isArray(plan?.plan_14j) ? plan.plan_14j : []
  const levers: string[] = Array.isArray(plan?.levers) ? plan.levers : []

  return (
    <div
      data-pdf-root="plan14j"
      style={{
        width: 794, // ~A4 at 96dpi
        padding: 48,
        background: '#ffffff',
        color: '#000000',
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
        lineHeight: 1.35,
      }}
    >
      <style>{`
        [data-pdf-root="plan14j"] h1 { font-size: 28px; margin: 0 0 8px; font-weight: 800; }
        [data-pdf-root="plan14j"] h2 { font-size: 18px; margin: 26px 0 10px; font-weight: 800; }
        [data-pdf-root="plan14j"] h3 { font-size: 14px; margin: 14px 0 6px; font-weight: 800; }
        [data-pdf-root="plan14j"] p { margin: 0 0 8px; font-size: 12px; }
        [data-pdf-root="plan14j"] .muted { color: #4b5563; }
        [data-pdf-root="plan14j"] .small { font-size: 11px; }
        [data-pdf-root="plan14j"] .hr { height: 1px; background: #e5e7eb; margin: 16px 0; }
        [data-pdf-root="plan14j"] ul { margin: 8px 0 0 18px; padding: 0; }
        [data-pdf-root="plan14j"] li { margin: 0 0 6px; font-size: 12px; }
        [data-pdf-root="plan14j"] img, [data-pdf-root="plan14j"] svg { display: block; margin: 0 auto; }
        [data-pdf-root="plan14j"] .flower-svg { overflow: visible !important; }
        [data-pdf-root="plan14j"] .box { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; }
        [data-pdf-root="plan14j"] .day { border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; margin: 10px 0; }
      `}</style>

      <h1>Plan 14 jours</h1>
      <p className="muted">
        Document imprimable — Fleur d&apos;AmOurs
      </p>

      <div style={{ marginTop: 18 }}>
        <FlowerSVG petals={petals} petalsDeficit={petalsDeficit} size={420} animate={false} showLabels={true} />
      </div>

      <div className="hr" />

      <h2>Phrase-synthèse</h2>
      <div className="box">
        <p style={{ fontStyle: 'italic' }}>
          {plan?.synthesis || plan?.synthesis_suggestion || ''}
        </p>
      </div>

      {anchors.length > 0 && (
        <>
          <h2>Ancres</h2>
          {anchors.map((a, i) => (
            <div key={i} className="day">
              <h3 style={{ marginTop: 0 }}>{a.subtitle || `Porte ${i + 1}`}</h3>
              {a.synthesis && <p style={{ fontStyle: 'italic' }}>&quot;{a.synthesis}&quot;</p>}
              {a.habit && <p className="small muted">Habitude : {a.habit}</p>}
            </div>
          ))}
        </>
      )}

      {levers.length > 0 && (
        <>
          <h2>Micro-leviers</h2>
          <ul>
            {levers.map((lever, i) => {
              const [action, anchor] = String(lever).split('||ANCHOR||')
              return (
                <li key={i}>
                  <strong> {action?.trim() || lever} </strong>
                  {anchor?.trim() ? <span className="muted"> — ancré dans {anchor.trim()}</span> : null}
                </li>
              )
            })}
          </ul>
        </>
      )}

      <h2>Plan 14 jours</h2>
      {days.length > 0 ? (
        days.map((d, idx) => (
          <div key={d.day ?? idx} className="day">
            <h3 style={{ marginTop: 0 }}>
              Jour {d.day ?? idx + 1}{d.theme ? ` — ${d.theme}` : ''}
            </h3>
            {d.action && <p>{d.action}</p>}
            {d.context && <p className="muted small">{d.context}</p>}
          </div>
        ))
      ) : (
        <p className="muted">Plan indisponible.</p>
      )}
    </div>
  )
}

