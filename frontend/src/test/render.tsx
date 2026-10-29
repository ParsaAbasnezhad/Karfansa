import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { RouterProvider } from 'react-router-dom'
import { createTestRouter } from '@/app/router'

export function renderApp(path = '/') {
  const router = createTestRouter([path])
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { router, ...utils }
}

export function mockHealth(ok: boolean) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        ok
          ? Response.json({
              status: 'ok',
              service: 'karfansa-backend',
              version: '0.1.0',
              time: '2026-10-26T10:00:00Z',
            })
          : new Response('down', { status: 503 }),
      ),
    ),
  )
}
