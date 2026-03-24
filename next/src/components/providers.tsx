'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { PushNotificationProvider } from '@/contexts/PushNotificationProvider'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60 * 1000 } },
      })
  )

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PushNotificationProvider>
            <NotificationProvider>{children}</NotificationProvider>
          </PushNotificationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
