import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { TradeOpportunity } from '@/features/trade/types'
import { renderWithProviders } from '@/test/render'
import { TradeOpportunitiesSection } from './TradeOpportunitiesSection'

const opportunity: TradeOpportunity = {
  id: 17,
  title: 'فرصت صادرات خرما',
  slug: 'date-export',
  province_slug: 'kerman',
  province_name_fa: 'کرمان',
  city_name_fa: 'بم',
  product_slug: 'dates',
  product_name_fa: 'خرما',
  service_listing_slug: null,
  industry_slug: null,
  industry_name_fa: null,
  opportunity_type: 'export',
  opportunity_type_display: 'صادرات',
  description: 'تأمین خرمای صادراتی با ظرفیت مشخص',
  target_market: 'امارات',
  required_volume: null,
  volume_unit: '',
  min_value: null,
  max_value: null,
  currency: '',
  company: { id: '1', slug: 'sample-company', name: 'شرکت نمونه' },
  source: '',
  source_url: '',
  published_at: '2026-10-01T12:00:00Z',
  valid_until: '2026-12-01',
  review_status: 'approved',
  review_status_display: 'تأییدشده',
  is_published: true,
  relevance_score: 80,
  last_reviewed_at: null,
  created_at: '2026-09-30T12:00:00Z',
}

describe('TradeOpportunitiesSection', () => {
  it('requests six newest public opportunities and links cards to their details', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [opportunity], count: 1, page: 1, page_size: 6, total_pages: 1 }) })
    vi.stubGlobal('fetch', fetchMock)

    renderWithProviders(<TradeOpportunitiesSection />)

    expect(await screen.findByRole('heading', { name: opportunity.title }, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByText('شرکت نمونه')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /مشاهده جزئیات/ })).toHaveAttribute('href', '/trade/date-export/')
    expect(screen.getByRole('link', { name: /مشاهده همه فرصت‌های تجاری/ })).toHaveAttribute('href', '/trade/')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const requested = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost')
    expect(requested.pathname).toBe('/api/v1/trade/opportunities/')
    expect(requested.searchParams.get('ordering')).toBe('newest')
    expect(requested.searchParams.get('page_size')).toBe('6')
  }, 10000)

  it('shows an empty state when no public opportunity exists', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [], count: 0, page: 1, page_size: 6, total_pages: 0 }) }))
    renderWithProviders(<TradeOpportunitiesSection />)
    expect(await screen.findByText(/فعلاً فرصت تجاری فعالی ثبت نشده است/)).toBeInTheDocument()
  })

  it('lets the visitor retry after a request error', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ ok: true, json: async () => ({ results: [opportunity], count: 1, page: 1, page_size: 6, total_pages: 1 }) })
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<TradeOpportunitiesSection />)
    await userEvent.click(await screen.findByRole('button', { name: 'تلاش دوباره' }))
    expect(await screen.findByRole('heading', { name: opportunity.title })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
