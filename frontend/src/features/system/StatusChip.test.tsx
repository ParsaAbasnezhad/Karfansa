import { screen } from '@testing-library/react'
import { mockHealth, renderApp } from '@/test/render'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('StatusChip', () => {
  it('shows that the server is connected when the health check succeeds', async () => {
    mockHealth(true)
    renderApp()

    expect(await screen.findByText('سرور متصل است')).toBeInTheDocument()
  })

  it('shows that the server is unavailable when the health check fails', async () => {
    mockHealth(false)
    renderApp()

    expect(await screen.findByText('سرور در دسترس نیست')).toBeInTheDocument()
  })
})
