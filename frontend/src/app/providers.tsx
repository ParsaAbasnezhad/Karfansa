import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ToastProvider } from '@/components/ToastProvider'
import { queryClient } from './query-client'
import { PwaProvider } from '@/pwa/PwaProvider'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <PwaProvider>
        <ToastProvider>{children}</ToastProvider>
      </PwaProvider>
    </QueryClientProvider>
  )
}
