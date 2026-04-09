'use client'

import { FlowerSVG, scoresToPetals } from '@/components/FlowerSVG'

type AnswerLike =
  | { dimension?: string; label?: string; dimension_chosen?: string; choice_label?: string }
  | null
  | undefined

export function FleurPrintable(props: {
  result: any
  answers: Array<AnswerLike>
  title?: string
}) {
  const { result, answers, title = "Ma Fleur d'AmOurs" } = props

  const scores = result?.scores || result?.result?.scores || {}
  const analysis = result?.analysis || result?.result?.analysis || null
  const createdAt = result?.created_at || result?.createdAt || result?.result?.created_at || ''

  const safeAnswers = Array.isArray(answers) ? answers : []
  const items = safeAnswers
    .map((a) => {
      const dim = String((a as any)?.dimension ?? (a as any)?.dimension_chosen ?? '').trim()
      const label = String((a as any)?.label ?? (a as any)?.choice_label ?? '').trim()
      if (!dim && !label) return null
      return { dim, label }
    })
    .filter(Boolean) as Array<{ dim: string; label: string }>

  return (
    <div
      data-pdf-root="fleur"
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
        [data-pdf-root="fleur"] h1 { font-size: 28px; margin: 0 0 6px; font-weight: 800; }
        [data-pdf-root="fleur"] h2 { font-size: 18px; margin: 22px 0 10px; font-weight: 800; }
        [data-pdf-root="fleur"] h3 { font-size: 14px; margin: 14px 0 6px; font-weight: 800; }
        [data-pdf-root="fleur"] p { margin: 0 0 8px; font-size: 12px; }
        [data-pdf-root="fleur"] .muted { color: #4b5563; }
        [data-pdf-root="fleur"] .small { font-size: 11px; }
        [data-pdf-root="fleur"] .hr { height: 1px; background: #e5e7eb; margin: 16px 0; }
        [data-pdf-root="fleur"] .box { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; }
        [data-pdf-root="fleur"] table { width: 100%; border-collapse: collapse; }
        [data-pdf-root="fleur"] th, [data-pdf-root="fleur"] td { border: 1px solid #e5e7eb; padding: 8px 10px; font-size: 12px; text-align: left; vertical-align: top; }
        [data-pdf-root="fleur"] th { background: #f9fafb; font-weight: 800; }
        [data-pdf-root="fleur"] img, [data-pdf-root="fleur"] svg { display: block; margin: 0 auto; }
        [data-pdf-root="fleur"] ul { margin: 8px 0 0 18px; padding: 0; }
        [data-pdf-root="fleur"] li { margin: 0 0 6px; font-size: 12px; }
      `}</style>

      <h1>{title}</h1>
      <p className="muted small">
        {createdAt ? `Date : ${new Date(createdAt).toLocaleString('fr-FR')}` : 'Document imprimable'}
      </p>

      <div style={{ marginTop: 18 }}>
        <FlowerSVG petals={scoresToPetals(scores)} size={320} animate={false} showLabels={false} />
      </div>

      <div className="hr" />

      {analysis?.dominant ? (
        <div className="box">
          <p>
            <strong>Dominante</strong> : {analysis.dominant}
          </p>
          {analysis?.global ? <p className="muted" style={{ fontStyle: 'italic' }}>{analysis.global}</p> : null}
        </div>
      ) : null}

      <h2>Scores</h2>
      <table>
        <thead>
          <tr>
            <th>Pétale</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(scores || {}).map(([k, v]) => (
            <tr key={k}>
              <td>{k}</td>
              <td>{String(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Réponses (historique)</h2>
      {items.length ? (
        <ul>
          {items.map((it, i) => (
            <li key={`${it.dim}-${i}`}>
              <strong>{it.dim}</strong> — {it.label}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Aucune réponse retrouvée.</p>
      )}
    </div>
  )
}

