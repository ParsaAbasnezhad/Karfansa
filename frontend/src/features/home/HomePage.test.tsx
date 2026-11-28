import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { HomePage } from './HomePage'

describe('HomePage (mock API)', () => {
  it('renders transport and analysis sections without news or financial markets', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    renderWithProviders(<HomePage />)
    expect(await screen.findByRole('heading', { name: 'شرکت‌های حمل و نقل' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'تحلیل و گزارش' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'بازارهای مالی' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'اپلیکیشن کارفنسا' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /اخبار/ })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByRole('article').length).toBeGreaterThan(3))
  })

  it('filters transport companies by tab', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    renderWithProviders(<HomePage />)
    const tabs = await screen.findByRole('tablist', { name: 'نوع شرکت' })
    await userEvent.click(within(tabs).getByRole('tab', { name: /دریایی/ }))
    expect(within(tabs).getByRole('tab', { name: /دریایی/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('shows an error box with retry when the API fails', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
    renderWithProviders(<HomePage />)
    expect((await screen.findAllByRole('alert')).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'تلاش دوباره' }).length).toBeGreaterThan(0)
    expect(
      vi.mocked(fetch).mock.calls.every(([url]) => !/news|ticker|newsletter/.test(String(url))),
    ).toBe(true)
    expect(
      vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/v1/home/slides/')),
    ).toBe(true)
    expect(
      vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/v1/trade/opportunities/')),
    ).toBe(true)
  })
})
