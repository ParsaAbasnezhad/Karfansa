import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { TradeOpportunityDetailPage } from './TradeOpportunityDetailPage'

describe('TradeOpportunityDetailPage', () => {
  it('loads the public detail endpoint for the linked slug', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 17,
        slug: 'date-export',
        title: 'فرصت صادرات خرما',
        description: 'شرح واقعی فرصت',
        province_slug: 'kerman',
        province_name_fa: 'کرمان',
        city_name_fa: 'بم',
        opportunity_type: 'export',
        opportunity_type_display: 'صادرات',
        company: null,
        product_name_fa: 'خرما',
        industry_name_fa: null,
        target_market: '',
        required_volume: null,
        min_value: null,
        max_value: null,
        published_at: '2026-10-01T00:00:00Z',
        valid_until: null,
        source: '',
        service_listing_slug: null,
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    renderWithProviders(
      <Routes><Route path="/trade/:slug/" element={<TradeOpportunityDetailPage />} /></Routes>,
      { route: '/trade/date-export/' },
    )

    expect(await screen.findByRole('heading', { name: 'فرصت صادرات خرما' })).toBeInTheDocument()
    expect(screen.getByText('شرح واقعی فرصت')).toBeInTheDocument()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/trade/opportunities/date-export/')
  })
})
