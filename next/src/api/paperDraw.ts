import { api } from '@/lib/api-client'
import type { PaperDrawLayoutId } from '@/lib/paper-draw-layouts'

export const paperDrawApi = {
  save: (data: {
    layout_template: PaperDrawLayoutId
    payload: Record<string, unknown>
  }) => api.post('/api/paper-draw/save', data),

  update: (id: string, payload: Record<string, unknown>) =>
    api.post('/api/paper-draw/update', { id, payload }),

  my: () => api.get('/api/paper-draw/my'),

  recognize: (data: {
    image: string
    layout_template: PaperDrawLayoutId
  }) => api.post('/api/paper-draw/recognize', data),

  interpret: (data: {
    layout_template: PaperDrawLayoutId
    intention?: string
    context?: string
    cards: Array<{ name: string; slot?: string; role?: string; duplicate?: boolean }>
    locale?: string
  }) => api.post('/api/paper-draw/interpret', data),

  dialogue: (data: {
    layout_template: PaperDrawLayoutId
    intention?: string
    context?: string
    cards: Array<{ name: string; slot?: string; role?: string }>
    history?: Array<{ role: string; content: string }>
    transcript: string
    locale?: string
  }) => api.post('/api/paper-draw/dialogue', data),
}
