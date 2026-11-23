import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { TransportationCompaniesPage } from './TransportationCompaniesPage'
import { TransportationCompanyDetailPage } from './TransportationCompanyDetailPage'

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

describe('transportation directory', () => {
  beforeAll(() => {
    class FakeIntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
  })

  it('filters by category and opens a company profile from the real API', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/v1/auth/me')) return jsonResponse({}, 401)
      if (url.includes('/v1/geography/provinces')) return jsonResponse([])
      if (url.includes('/transport-types/')) {
        return jsonResponse([
          { code: 'road', name_fa: 'حمل‌ونقل جاده‌ای', name_en: 'Road', company_count: 1 },
          { code: 'sea', name_fa: 'حمل‌ونقل دریایی', name_en: 'Sea', company_count: 0 },
          { code: 'air', name_fa: 'حمل‌ونقل هوایی', name_en: 'Air', company_count: 0 },
          { code: 'rail', name_fa: 'حمل‌ونقل ریلی', name_en: 'Rail', company_count: 0 },
          {
            code: 'multimodal',
            name_fa: 'حمل‌ونقل ترکیبی',
            name_en: 'Multimodal',
            company_count: 0,
          },
          {
            code: 'warehouse',
            name_fa: 'انبارداری و لجستیک',
            name_en: 'Warehousing',
            company_count: 0,
          },
          {
            code: 'international',
            name_fa: 'حمل‌ونقل بین‌المللی',
            name_en: 'International',
            company_count: 0,
          },
          {
            code: 'customs',
            name_fa: 'ترخیص کالا و خدمات گمرکی',
            name_en: 'Customs',
            company_count: 0,
          },
          { code: 'urban', name_fa: 'حمل‌ونقل شهری و توزیع', name_en: 'Urban', company_count: 0 },
        ])
      }
      if (url.includes('/v1/transport-companies/alpha-freight/')) {
        return jsonResponse({
          id: '1',
          slug: 'alpha-freight',
          name: 'باربری آلفا',
          english_name: 'Alpha Freight',
          logo: null,
          cover_image: null,
          description: 'حمل جاده‌ای داخلی',
          province: { name_fa: 'تهران', slug: 'tehran' },
          city: { name_fa: 'تهران', slug: 'tehran' },
          transport_types: [{ code: 'road', name_fa: 'حمل‌ونقل جاده‌ای', name_en: 'Road' }],
          tracking_available: true,
          insurance_available: false,
          customs_services: false,
          is_verified: true,
          fleet_capacity: '۲۰ کامیون',
          vehicle_types: [{ slug: 'truck', name_fa: 'کامیون', name_en: 'Truck' }],
          service_provinces: [{ slug: 'tehran', name_fa: 'تهران' }],
          origin_countries: [],
          destination_countries: [],
          address: 'تهران',
          phone: '+982112345678',
          mobile: '',
          email: 'contact@example.com',
          website: 'https://example.com',
          whatsapp: '',
          telegram: '@alpha_freight',
          instagram: 'https://www.instagram.com/alpha.freight/',
        })
      }
      if (url.includes('/v1/transport-companies/')) {
        return jsonResponse({
          items: [
            {
              id: '1',
              slug: 'alpha-freight',
              name: 'باربری آلفا',
              english_name: 'Alpha Freight',
              logo: null,
              cover_image: null,
              description: 'حمل جاده‌ای داخلی',
              province: { name_fa: 'تهران' },
              city: { name_fa: 'تهران' },
              transport_types: [{ code: 'road', name_fa: 'حمل‌ونقل جاده‌ای', name_en: 'Road' }],
              tracking_available: true,
              insurance_available: false,
              customs_services: false,
              is_verified: true,
              fleet_capacity: '۲۰ کامیون',
            },
          ],
          count: 1,
        })
      }
      return jsonResponse({}, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    renderWithProviders(
      <Routes>
        <Route path="/transportation/companies" element={<TransportationCompaniesPage />} />
        <Route
          path="/transportation/companies/:slug"
          element={<TransportationCompanyDetailPage />}
        />
      </Routes>,
      { route: '/transportation/companies' },
    )

    expect(
      await screen.findByRole('heading', { name: 'شبکه شرکت‌های حمل‌ونقل و لجستیک' }),
    ).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'باربری آلفا' })).toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: /حمل‌ونقل جاده‌ای/ }))
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('transport_type=road')

    await user.click(screen.getByRole('link', { name: /باربری آلفا/ }))
    expect(await screen.findByText('۲۰ کامیون')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'خدمات حمل‌ونقل' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /تلفن شرکت/ })).toHaveAttribute(
      'href',
      'tel:+982112345678',
    )
    expect(screen.getByRole('link', { name: /contact@example.com/ })).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:contact@example.com?subject='),
    )
    const telegramLink = screen.getByRole('link', { name: /تلگرام/ })
    expect(telegramLink).toHaveAttribute('href', 'https://t.me/alpha_freight')
    expect(telegramLink).toHaveAttribute('target', '_blank')
    expect(telegramLink).toHaveAttribute('rel', 'noopener noreferrer')
    const instagramLink = screen.getByRole('link', { name: /اینستاگرام/ })
    expect(instagramLink).toHaveAttribute('href', 'https://www.instagram.com/alpha.freight/')
    expect(instagramLink).toHaveAttribute('target', '_blank')
    expect(instagramLink).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.queryByText('فرصت‌های تجاری')).not.toBeInTheDocument()
  })
})
