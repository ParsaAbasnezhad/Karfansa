import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ToastProvider'
import { PwaProvider } from '@/pwa/PwaProvider'

export function renderWithProviders(ui: ReactElement, { route = '/' }: { route?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <PwaProvider>
          <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
        </PwaProvider>
      </ToastProvider>
    </QueryClientProvider>,
  )
}
