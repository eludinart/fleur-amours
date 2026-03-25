import { api } from '@/lib/api-client'

export type SystemStatus = {
  hostname: string
  platform: string
  arch: string
  uptimeSeconds: number
  uptimeFormatted: string
  memory: { heapUsed: string; heapTotal: string; rss: string; external: string }
  memoryRaw: { heapUsed: number; heapTotal: number; rss: number }
  cpu: { cores: number; loadAvg1m: string; loadAvg5m: string; loadAvg15m: string }
  publicIp: string | null
  nodeEnv: string
  coolify: {
    configured: boolean
    servers: Array<{ name: string; ip: string; uuid: string; unreachable?: boolean }>
  }
}

export const adminApi = {
  systemStatus: () => api.get('/api/admin/system-status') as Promise<SystemStatus>,
  dbStatus: () =>
    api.get('/api/admin/db-status') as Promise<{
      connected: boolean
      error?: string
      connectionInfo: {
        host: string
        port: number
        database: string
        user: string
        prefix: string
        viaTunnel?: boolean
        tunnelTarget?: string
      } | null
      version: string | null
      poolStats: { connections?: number; latencyMs?: number } | null
      latencyMs?: number | null
    }>,
  getPrompts: (type?: string) =>
    api.get('/api/admin/prompts' + (type ? `?type=${encodeURIComponent(type)}` : '')),
  createPrompt: (data: Record<string, unknown>) =>
    api.post('/api/admin/prompts/create', data),
  updatePrompt: (data: Record<string, unknown>) =>
    api.post('/api/admin/prompts/update', data),
  deletePrompt: (id: string | number) => api.post('/api/admin/prompts/delete', { id: String(id) }),
  setActivePrompts: (activeTuteurId: string | number | null, activeThresholdId: string | number | null) =>
    api.post('/api/admin/prompts/set-active', {
      active_tuteur_id: activeTuteurId != null ? String(activeTuteurId) : null,
      active_threshold_id: activeThresholdId != null ? String(activeThresholdId) : null,
    }),
  seedDefaults: () => api.post('/api/admin/prompts/seed-defaults', {}),
  importFromFile: () => api.post('/api/admin/prompts/import-from-file', {}),
  getAnalyzeMoodPrompt: () => api.get('/api/admin/prompts/analyze-mood'),
  saveAnalyzeMoodPrompt: (content: string) =>
    api.post('/api/admin/prompts/analyze-mood', { content }),

  getScienceConfig: () => api.get('/api/admin/science/config') as Promise<any>,
  saveScienceConfig: (config: Record<string, unknown>) => api.post('/api/admin/science/config', config),
  rebuildScienceProfile: (params: { user_id: number; locale?: string; petals?: Record<string, number> }) =>
    api.post('/api/admin/science/rebuild', params),
}
