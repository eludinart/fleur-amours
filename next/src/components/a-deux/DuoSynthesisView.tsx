'use client'

import { computeDuoAnalysis } from '@/lib/duo-analysis'
import { UnifiedDuoResultView } from '@/components/a-deux/UnifiedDuoResultView'
import type { DuoPartnerOption } from '@/components/a-deux/DuoPartnerSelector'

type DuoSynthesisViewProps = {
  duoData: {
    person_a: Record<string, unknown>
    person_b?: Record<string, unknown>
    duo?: ReturnType<typeof computeDuoAnalysis>
    invite_token?: string
  }
  allPairings?: DuoPartnerOption[]
  onReset?: () => void
}

export function DuoSynthesisView({ duoData, allPairings, onReset }: DuoSynthesisViewProps) {
  const token = duoData.invite_token || ''
  return (
    <UnifiedDuoResultView
      person_a={duoData.person_a as Parameters<typeof UnifiedDuoResultView>[0]['person_a']}
      person_b={duoData.person_b as Parameters<typeof UnifiedDuoResultView>[0]['person_b']}
      duo={duoData.duo}
      pairingToken={token}
      allPairings={allPairings}
      onReset={onReset}
    />
  )
}
