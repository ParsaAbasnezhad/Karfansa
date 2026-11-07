import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { MarketsPage } from './MarketsPage'

describe('MarketsPage', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('shows clearly labeled sample market data when the API is unavailable', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('API unavailable')))

    renderWithProviders(<MarketsPage />)

    expect(
      await screen.findByText('API بازار هنوز در دسترس نیست؛ فعلاً دادهٔ نمونه نمایش داده می‌شود.'),
    ).toBeInTheDocument()
    expect(screen.getByText('دلار')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
