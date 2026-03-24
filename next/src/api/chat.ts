import { api } from '@/lib/api-client'

export const chatApi = {
  startConversation: () => api.post('/api/chat/conversations/start', {}),
  myConversations: () => api.get('/api/chat/conversations/my'),
  listConversations: (params: Record<string, unknown> = {}) => {
    const clean = Object.fromEntries(
      Object.entries(params).filter(
        ([, v]) => v !== undefined && v !== null && v !== ''
      )
    )
    const q = new URLSearchParams(clean as Record<string, string>).toString()
    return api.get(`/api/chat/conversations/list${q ? '?' + q : ''}`)
  },
  closeConversation: (id: string) =>
    api.post('/api/chat/conversations/close', { id }),
  deleteConversation: (id: string) =>
    api.post('/api/chat/conversations/delete', { id }),
  messages: (conversationId: string, since?: string) => {
    const params: Record<string, string> = { conversation_id: conversationId }
    if (since) params.since = since
    const q = new URLSearchParams(params).toString()
    return api.get(`/api/chat/messages?${q}`)
  },
  send: (conversationId: string, content: string, senderRole = 'user') =>
    api.post('/api/chat/send', {
      conversation_id: conversationId,
      content,
      sender_role: senderRole,
    }),
  markRead: (conversationId: string, readerRole: string) =>
    api.post('/api/chat/mark_read', {
      conversation_id: conversationId,
      reader_role: readerRole,
    }),
  unread: () => api.get('/api/chat/unread'),
  stats: () => api.get('/api/chat/stats'),
}
