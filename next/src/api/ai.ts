import { api } from '@/lib/api-client'

export const aiApi = {
  status: () => api.get('/api/ai/status'),
  testOpenRouter: () => api.get('/api/ai/test'),
  threshold: (payload: { first_words: string }) =>
    api.post('/api/ai/threshold', payload),
  tuteur: (payload: Record<string, unknown>) =>
    api.post('/api/ai/tuteur', payload),
  extractDoorSummary: (payload: { history: Array<{ role: string; content: string }>; door_subtitle: string }) =>
    api.post('/api/ai/extract_door_summary', payload),
  doorIntro: (payload: { door: string; first_words: string; anchors: unknown[] }) =>
    api.post('/api/ai/door-intro', payload),
  plan14j: (payload: Record<string, unknown>) =>
    api.post('/api/ai/plan14j', payload),
  coachFiche: (payload: { sessionId: string | number; force?: boolean }) =>
    api.post('/api/ai/coach-fiche', payload),
  coachPatientFiche: (payload: { patientEmail: string; force?: boolean; coachUserId?: string | number }) =>
    api.post('/api/ai/coach-patient-fiche', payload),
  cardContext: (payload: Record<string, unknown>) =>
    api.post('/api/ai/card-context', payload),
  cardQuestion: (payload: Record<string, unknown>) =>
    api.post('/api/ai/card-question', payload),
  fleurInterpretation: (payload: Record<string, unknown>) =>
    api.post('/api/ai/fleur-interpretation', payload),
  analyzeMood: (payload: { text: string }) =>
    api.post('/api/ai/analyze_mood', payload),
  dreamscapeSummarize: (payload: { history: Array<{ role: string; content: string }> }) =>
    api.post('/api/ai/dreamscape_summarize', payload),
  helpChat: (payload: {
    message: string
    history?: Array<{ role: string; content: string }>
    context?: { current_page?: string }
    current_page?: string
  }) =>
    api.post('/api/help-chat', {
      message: payload.message,
      history: payload.history ?? [],
      context: {
        current_page:
          payload.current_page ?? payload.context?.current_page ?? '',
      },
    }),
}
