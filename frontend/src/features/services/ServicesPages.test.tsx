import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { ServicesLandingPage } from './ServicesPages'

describe('services marketplace', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('renders categories and approved listings returned by the real API client', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        const body = url.includes('/categories/')
          ? [
              {
                id: 1,
                name: 'کشاورزی',
                slug: 'agriculture',
                description: '',
                parent_id: null,
                children: [],
              },
            ]
          : {
              results: [
                {
                  id: 1,
                  title: 'زعفران ممتاز',
                  slug: 'saffron',
                  description: 'زعفران باکیفیت تولیدشده در مزرعه خانوادگی.',
                  category_id: 1,
                  category_name: 'کشاورزی',
                  category_slug: 'agriculture',
                  seller: {
                    id: 1,
                    display_name: 'کشاورز نمونه',
                    bio: '',
                    province_id: 1,
                    city_id: null,
                    province_name: 'خراسان رضوی',
                    city_name: null,
                    is_public: true,
                  },
                  province_id: 1,
                  province_name: 'خراسان رضوی',
                  province_slug: 'razavi-khorasan',
                  city_id: null,
                  city_name: null,
                  sale_mode: 'both',
                  sale_mode_display: 'فروش داخلی و صادرات',
                  quantity: '25',
                  unit: 'کیلوگرم',
                  price: '1200000',
                  currency: 'IRR',
                  is_price_negotiable: false,
                  minimum_order_quantity: '1',
                  quality: 'درجه یک',
                  packaging: 'پاکت',
                  is_export_available: true,
                  is_domestic_available: true,
                  status: 'approved',
                  status_display: 'تأییدشده',
                  is_active: true,
                  rejection_reason: '',
                  images: [],
                  specifications: [],
                  created_at: '2026-01-01T00:00:00Z',
                  updated_at: '2026-01-01T00:00:00Z',
                  published_at: '2026-01-01T00:00:00Z',
                },
              ],
              count: 1,
              page: 1,
              page_size: 6,
              total_pages: 1,
            }
        return Promise.resolve(
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }),
    )

    renderWithProviders(<ServicesLandingPage />)

    expect(await screen.findByRole('heading', { name: 'زعفران ممتاز' })).toBeInTheDocument()
    expect(
      screen.getAllByRole('link', { name: /کشاورزی/ }).some(
        (link) => link.getAttribute('href') === '/services/listings?category=agriculture',
      ),
    ).toBe(true)
    expect(screen.getByText('آماده صادرات')).toBeInTheDocument()
  })
})
