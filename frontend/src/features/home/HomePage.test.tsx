import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { HomePage } from './HomePage'

describe('HomePage (mock API)', () => {
  it('renders every section from the API', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    renderWithProviders(<HomePage />)
    expect(await screen.findByRole('heading', { name: 'شرکت‌های حمل و نقل' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'بازارهای مالی' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'اخبار شرکت‌ها' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'تحلیل و گزارش' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByRole('article').length).toBeGreaterThan(5))
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
  })
})
