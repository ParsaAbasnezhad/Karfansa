import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { HomeSlider } from './HomeSlider'

const slides = [
  { id: 1, title: 'اسلاید اول', short_text: 'متن اول', description: 'شرح اول', image: '/media/slides/first.jpg', created_at: '2026-01-01T00:00:00Z' },
  { id: 2, title: 'اسلاید دوم', short_text: 'متن دوم', description: 'شرح دوم', image: '/media/slides/second.jpg', created_at: '2026-01-02T00:00:00Z' },
]

describe('HomeSlider', () => {
  it('loads admin-managed slides and switches with accessible controls', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: slides }) })
    vi.stubGlobal('fetch', fetchMock)

    const { container } = renderWithProviders(<HomeSlider />)

    expect(await screen.findByRole('heading', { name: 'اسلاید اول' })).toBeInTheDocument()
    expect(container.querySelector('.home-slider-image')).toHaveAttribute('src', '/media/slides/first.jpg')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/home/slides/')

    await userEvent.click(screen.getByRole('button', { name: 'اسلاید بعدی' }))
    expect(screen.getByRole('heading', { name: 'اسلاید دوم' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'اسلاید ۱' }))
    expect(screen.getByRole('heading', { name: 'اسلاید اول' })).toBeInTheDocument()
  })

  it('shows a clear empty state when no slide is active', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) }))
    renderWithProviders(<HomeSlider />)
    expect(await screen.findByText('اسلاید فعالی برای نمایش وجود ندارد.')).toBeInTheDocument()
  })
})
