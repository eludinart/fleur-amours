import { api } from '@/lib/api-client'

export const diagnosticApi = {
  run: (payload: Record<string, unknown>) =>
    api.post('/api/diagnostic', payload),
}
