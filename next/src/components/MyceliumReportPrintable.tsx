'use client'

import type { StatsDTO, MyceliumSynthesisDTO } from '@/api/mycelium'
import { PETAL_IDS_ORDER, petalLabel } from '@/lib/mycelium-lexicon'
import { t } from '@/i18n'

type Props = {
  stats: StatsDTO
  synthesis: MyceliumSynthesisDTO | null
  generatedAt?: string
}

/** Layout imprimable pour export PDF synthèse QVT. */
export function MyceliumReportPrintable({ stats, synthesis, generatedAt }: Props) {
  const climate = stats.dashboard.current
  const dateStr =
    generatedAt ??
    new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div
      className="hidden print:block"
      aria-hidden
      style={{ position: 'absolute', left: '-9999px', top: 0, width: '794px', background: '#fff', color: '#111', padding: '32px', fontFamily: 'Georgia, serif' }}
      data-pdf-export="1"
      id="mycelium-report-print"
    >
      <header className="pdf-avoid-break" style={{ borderBottom: '2px solid #059669', paddingBottom: '16px', marginBottom: '24px' }}>
        <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#059669', margin: 0 }}>
          Mycelium · Synthèse QVT
        </p>
        <h1 style={{ fontSize: '22px', margin: '8px 0 4px', color: '#111' }}>{stats.org?.name ?? 'Organisation'}</h1>
        <p style={{ fontSize: '12px', color: '#555', margin: 0 }}>
          {t('mycelium.reportPeriod')} {climate.windowDays} {t('mycelium.reportDays')} · {dateStr}
        </p>
      </header>

      <section className="pdf-avoid-break" style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '14px', color: '#059669', marginBottom: '8px' }}>{t('mycelium.reportAdoption')}</h2>
        <p style={{ fontSize: '13px', lineHeight: 1.5, margin: 0 }}>
          {stats.members} {t('mycelium.statMembers').toLowerCase()} · {stats.adoption.participationRate}%{' '}
          {t('mycelium.participationRate').toLowerCase()} · {stats.adoption.withProfile} {t('mycelium.profilesCount').toLowerCase()} ·{' '}
          {stats.adoption.checkinCount30d} {t('mycelium.pulses30d').toLowerCase()}
        </p>
      </section>

      {climate.available && (
        <section className="pdf-avoid-break" style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '14px', color: '#059669', marginBottom: '8px' }}>{t('mycelium.reportClimate')}</h2>
          <p style={{ fontSize: '13px', margin: '0 0 8px' }}>
            {t('mycelium.respondents')}: {climate.respondents} · {t('mycelium.moodAvg')}:{' '}
            {climate.moodAverage != null ? `${climate.moodAverage}/5` : '—'}
            {stats.dashboard.moodDelta != null && (
              <> · {t('mycelium.moodTrend')}: {stats.dashboard.moodDelta > 0 ? '+' : ''}{stats.dashboard.moodDelta}</>
            )}
          </p>
          {climate.petalsAverage && (
            <ul style={{ fontSize: '12px', paddingLeft: '18px', margin: 0 }}>
              {PETAL_IDS_ORDER.map((id) => (
                <li key={id} style={{ marginBottom: '4px' }}>
                  {petalLabel(id, 'B')}: {Math.round((climate.petalsAverage![id] ?? 0) * 100)}%
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {synthesis && (
        <section className="pdf-avoid-break" style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '14px', color: '#059669', marginBottom: '8px' }}>{t('mycelium.synthesisTitle')}</h2>
          <p style={{ fontSize: '13px', lineHeight: 1.6, margin: '0 0 12px' }}>{synthesis.summary}</p>
          {synthesis.actions.length > 0 && (
            <>
              <h3 style={{ fontSize: '12px', margin: '0 0 6px' }}>{t('mycelium.synthesisActions')}</h3>
              <ol style={{ fontSize: '12px', paddingLeft: '18px', margin: 0 }}>
                {synthesis.actions.map((a, i) => (
                  <li key={i} style={{ marginBottom: '6px' }}>
                    {a}
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      )}

      {stats.alerts.length > 0 && (
        <section>
          <h2 style={{ fontSize: '14px', color: '#b45309', marginBottom: '8px' }}>{t('mycelium.alertsTitle')}</h2>
          <ul style={{ fontSize: '12px', paddingLeft: '18px', margin: 0 }}>
            {stats.alerts.map((a) => (
              <li key={a.petalId} style={{ marginBottom: '8px' }}>
                <strong>{a.label}</strong> — {a.hint}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer style={{ marginTop: '32px', fontSize: '10px', color: '#888', borderTop: '1px solid #ddd', paddingTop: '12px' }}>
        {t('mycelium.privacyNote')}
      </footer>
    </div>
  )
}
