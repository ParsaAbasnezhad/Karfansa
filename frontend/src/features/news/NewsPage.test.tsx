import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { NewsPage } from './NewsPage'

describe('NewsPage', () => {
  it('displays RSS news and allows filtering by topic', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    renderWithProviders(<NewsPage />)

    expect(await screen.findByRole('heading', { name: 'اخبار اقتصادی' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /رشد ۲٫۳ درصدی اقتصاد ایران/ })).toBeVisible()

    const topics = screen.getByRole('navigation', { name: 'فیلتر موضوع خبر' })
    await userEvent.click(within(topics).getByRole('button', { name: 'انرژی' }))

    expect(within(topics).getByRole('button', { name: 'انرژی' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      await screen.findByRole('heading', { name: /صادرات فرآورده‌های نفتی/ }),
    ).toBeVisible()
  })

  it('shows an actionable error state when news cannot be loaded', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    renderWithProviders(<NewsPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('دریافت خبرها ممکن نشد')
    expect(screen.getByRole('button', { name: 'تلاش دوباره' })).toBeVisible()
  })
})
