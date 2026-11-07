import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '@/test/render'
import { IndustriesPage } from './IndustriesPage'
import { ProvinceDetailPage } from './ProvinceDetailPage'
import { ProvincesPage } from './ProvincesPage'
import provinceMap from './iran-provinces-map.json'

describe('province pages', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('includes clickable boundary data for all 31 provinces', () => {
    expect(provinceMap.provinces).toHaveLength(31)
    expect(new Set(provinceMap.provinces.map((province) => province.slug)).size).toBe(31)
    expect(provinceMap.provinces.every((province) => province.path.startsWith('M'))).toBe(true)
  })

  it('lists only published provinces', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          { id: 1, slug: 'tehran', name_fa: 'تهران', name_en: 'Tehran', is_published: true },
          {
            id: 2,
            slug: 'draft',
            name_fa: 'استان پیش‌نویس',
            name_en: 'Draft',
            is_published: false,
          },
        ],
      }),
    )

    renderWithProviders(<ProvincesPage />)

    expect(
      await screen.findByRole('group', { name: 'نقشهٔ تعاملی استان‌های ایران' }),
    ).toBeInTheDocument()
    expect(document.querySelector('.iran-map-link')?.getAttribute('href')).toBe(
      '/provinces/tehran/',
    )
    expect(screen.getByRole('link', { name: '© مشارکت‌کنندگان OpenStreetMap' })).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/copyright',
    )
    expect(screen.queryByText('استان پیش‌نویس')).not.toBeInTheDocument()
  })

  it('shows verified geographic fields and cities without inventing missing statistics', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 1,
          slug: 'tehran',
          name_fa: 'تهران',
          name_en: 'Tehran',
          is_published: true,
          short_description: '',
          description: '',
          economic_description: '',
          area_sq_km: null,
          population: null,
          latitude: null,
          longitude: null,
          featured_image: null,
          map_image: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          capital: {
            id: 1,
            province_id: 1,
            slug: 'تهران',
            name_fa: 'تهران',
            name_en: '',
            population: null,
            description: '',
            is_county_center: false,
            latitude: null,
            longitude: null,
          },
          cities: [
            {
              id: 1,
              province_id: 1,
              slug: 'تهران',
              name_fa: 'تهران',
              name_en: '',
              population: null,
              description: '',
              is_county_center: false,
              latitude: null,
              longitude: null,
            },
          ],
          industries: [
            {
              id: 1,
              province_id: 1,
              province_slug: 'tehran',
              province_name_fa: 'تهران',
              industry_id: 1,
              industry_slug: 'food',
              industry_name_fa: 'صنایع غذایی',
              industry_name_en: 'Food',
              category: 'food',
              category_display: 'صنایع غذایی',
              industry_description: '',
              image: null,
              description: 'توضیحات صنعت در استان',
              activity_level: 'high',
              activity_level_display: 'بالا',
              production_capacity: '12',
              production_capacity_unit: 'تن',
              competitive_advantage: 'مزیت محلی',
              source: 'گزارش رسمی',
              source_url: 'https://example.com/source',
              updated_year: 1404,
              active_cities: [],
              products: [
                {
                  id: 1,
                  slug: 'food-product',
                  name_fa: 'محصول غذایی',
                  name_en: 'Food product',
                  description: '',
                },
              ],
              companies: [{ slug: 'food-company', name: 'شرکت غذایی' }],
            },
          ],
        }),
      }),
    )

    renderWithProviders(
      <Routes>
        <Route path="/provinces/:slug/" element={<ProvinceDetailPage />} />
      </Routes>,
      { route: '/provinces/tehran/' },
    )

    expect(await screen.findByRole('heading', { name: 'تهران' })).toBeInTheDocument()
    expect(screen.getAllByText('ثبت نشده')).toHaveLength(7)
    expect(
      screen.getByText('تهران', { selector: '.province-city-list strong' }),
    ).toBeInTheDocument()
    expect(screen.getByText('اطلاعات اقتصادی معتبر هنوز ثبت نشده است.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'صنایع و ظرفیت‌های تولیدی' })).toBeInTheDocument()
    expect(screen.getByText('محصول غذایی')).toBeInTheDocument()
    expect(screen.getByText('شرکت غذایی')).toBeInTheDocument()
    expect(screen.getByText('۱۲ تن')).toBeInTheDocument()
    expect(screen.getByText('گزارش رسمی')).toBeInTheDocument()
    expect(screen.getByText('Tehran', { selector: '.province-name-en' })).toBeInTheDocument()
    expect(screen.getByText('شناسنامهٔ استان')).toBeInTheDocument()
  })

  it('filters published industries by selected category and province', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const fetchMock = vi.fn().mockImplementation(async (input: string) => {
      if (String(input).includes('/v1/geography/provinces/')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              id: 1,
              slug: 'tehran',
              name_fa: 'تهران',
              name_en: 'Tehran',
              is_published: true,
            },
          ],
        }
      }
      return { ok: true, status: 200, json: async () => [] }
    })
    vi.stubGlobal('fetch', fetchMock)

    renderWithProviders(<IndustriesPage />)

    await screen.findByRole('option', { name: 'تهران' })
    await userEvent.selectOptions(screen.getByLabelText('استان'), 'tehran')
    await userEvent.selectOptions(screen.getByLabelText('دسته‌بندی صنعت'), 'energy')

    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/v1/geography/industries/?province=tehran&category=energy',
      expect.any(Object),
    )
    expect(
      await screen.findByText('برای این فیلتر هنوز صنعت منتشرشده‌ای ثبت نشده است.'),
    ).toBeInTheDocument()
  })
})
