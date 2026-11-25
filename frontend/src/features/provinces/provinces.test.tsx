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
    vi.restoreAllMocks()
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
    const originalMatchMedia = window.matchMedia.bind(window)
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      ...originalMatchMedia(query),
      matches: query === '(min-width: 768px)',
    }))
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
    expect(
      screen.getByRole('link', { name: '© داده‌های جغرافیایی OpenStreetMap' }),
    ).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright')
    expect(screen.queryByText('استان پیش‌نویس')).not.toBeInTheDocument()
  })

  it('does not mount the interactive map on mobile and keeps province navigation', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const originalMatchMedia = window.matchMedia.bind(window)
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      ...originalMatchMedia(query),
      matches: false,
    }))
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          { id: 1, slug: 'tehran', name_fa: 'تهران', name_en: 'Tehran', is_published: true },
        ],
      }),
    )

    renderWithProviders(<ProvincesPage />)

    const provinceLink = await screen.findByRole('link', { name: 'مشاهدهٔ صفحهٔ تهران' })
    expect(document.querySelector('.iran-map-panel')).not.toBeInTheDocument()
    expect(document.querySelector('.iran-map-svg')).not.toBeInTheDocument()
    expect(provinceLink).toHaveAttribute('href', '/provinces/tehran/')
  })

  it.each([320, 375, 390, 430, 768, 1440])('matches the map breakpoint at %ipx', async (width) => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const originalMatchMedia = window.matchMedia.bind(window)
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      ...originalMatchMedia(query),
      matches: query === '(min-width: 768px)' && width >= 768,
    }))
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          { id: 1, slug: 'tehran', name_fa: 'تهران', name_en: 'Tehran', is_published: true },
        ],
      }),
    )

    const { unmount } = renderWithProviders(<ProvincesPage />)

    await screen.findByText('تهران', { selector: '.iran-directory-select strong' })
    if (width >= 768) {
      await screen.findByRole('group', { name: 'نقشهٔ تعاملی استان‌های ایران' })
    }
    expect(Boolean(document.querySelector('.iran-map-panel'))).toBe(width >= 768)
    unmount()
  })

  it('normalizes Persian province searches and preserves province navigation', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          { id: 1, slug: 'yazd', name_fa: 'یزد', name_en: 'Yazd', is_published: true },
          { id: 2, slug: 'qom', name_fa: 'قم', name_en: 'Qom', is_published: true },
        ],
      }),
    )

    renderWithProviders(<ProvincesPage />)

    await screen.findByText('یزد', { selector: '.iran-directory-select strong' })
    await userEvent.type(screen.getByRole('searchbox', { name: 'جست‌وجوی استان' }), 'يَزْد')

    expect(
      screen.getByText('یزد', { selector: '.iran-directory-select strong' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('قم', { selector: '.iran-directory-select strong' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'مشاهدهٔ صفحهٔ یزد' })).toHaveAttribute(
      'href',
      '/provinces/yazd/',
    )
  })

  it('synchronizes province selection and shows only API-backed economic counts', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const originalMatchMedia = window.matchMedia.bind(window)
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      ...originalMatchMedia(query),
      matches: query === '(min-width: 768px)',
    }))
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (input: string) => {
        const url = String(input)
        const payload = url.includes('/v1/organizations/')
          ? { count: 8, results: [] }
          : url.includes('/v1/trade/opportunities/')
            ? { count: 3, results: [] }
            : url.includes('/v1/geography/provinces/tehran/')
              ? { id: 1, slug: 'tehran', name_fa: 'تهران', industries: [], statistics: [] }
              : [
                  {
                    id: 1,
                    slug: 'tehran',
                    name_fa: 'تهران',
                    name_en: 'Tehran',
                    is_published: true,
                  },
                ]
        return { ok: true, status: 200, json: async () => payload }
      }),
    )

    renderWithProviders(<ProvincesPage />)

    await screen.findByRole('group', { name: 'نقشهٔ تعاملی استان‌های ایران' })
    await userEvent.click(screen.getByRole('button', { name: /تهران/ }))

    expect(await screen.findByText('کسب‌وکار فعال: ۸')).toBeInTheDocument()
    expect(screen.getByText('فرصت تجاری: ۳')).toBeInTheDocument()
    expect(document.querySelector('.iran-map-link')).toHaveClass('is-selected')

    const mapProvince = document.querySelector<HTMLElement>('.iran-map-link')
    expect(mapProvince).not.toBeNull()
    if (mapProvince) await userEvent.hover(mapProvince)
    expect(document.querySelector('.iran-directory-row')).toHaveClass('is-active')
    expect(document.querySelector('.iran-map-tooltip')).toHaveTextContent('تهران')
  })

  it('shows verified geographic fields and cities without inventing missing statistics', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (input: string) => ({
        ok: true,
        status: 200,
        json: async () => {
          if (input.includes('/statistics/indicators/')) return []
          if (input.includes('/statistics/')) return []
          if (input.includes('/provinces/?')) return []
          return {
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
            statistics: [],
          }
        },
      })),
    )

    renderWithProviders(
      <Routes>
        <Route path="/provinces/:slug/" element={<ProvinceDetailPage />} />
      </Routes>,
      { route: '/provinces/tehran/' },
    )

    expect(await screen.findByRole('heading', { name: 'تهران' })).toBeInTheDocument()
    expect(screen.getAllByText('ثبت نشده')).toHaveLength(6)
    expect(
      screen.getByText('تهران', { selector: '.province-city-list strong' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('هنوز دادهٔ اقتصادی تأییدشده‌ای برای این استان ثبت نشده است.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'صنایع و ظرفیت‌های تولیدی' })).toBeInTheDocument()
    expect(screen.getByText('محصول غذایی')).toBeInTheDocument()
    expect(screen.getByText('شرکت غذایی')).toBeInTheDocument()
    expect(screen.getByText('۱۲ تن')).toBeInTheDocument()
    expect(screen.getByText('گزارش رسمی')).toBeInTheDocument()
    expect(screen.getByText('Tehran', { selector: '.province-name-en' })).toBeInTheDocument()
    expect(screen.getByText('شناسنامهٔ استان')).toBeInTheDocument()
  })

  it('charts documented statistics and only compares matching units and periods', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const tehranStatistics = [
      {
        id: 1,
        province_slug: 'tehran',
        province_name_fa: 'تهران',
        indicator: 'export_value',
        indicator_display: 'ارزش صادرات استان',
        category: 'foreign_trade',
        category_display: 'تجارت خارجی',
        value: '12.5',
        value_text: '',
        item_label: '',
        unit: 'میلیون دلار',
        statistical_year: 1402,
        period: 'annual',
        period_display: 'سالانه',
        period_number: null,
        source: 'گمرک جمهوری اسلامی ایران',
        source_url: 'https://example.com/tehran-export',
        source_published_at: '2024-01-01',
        collected_at: '2024-02-01',
        notes: '',
      },
      {
        id: 2,
        province_slug: 'tehran',
        province_name_fa: 'تهران',
        indicator: 'export_value',
        indicator_display: 'ارزش صادرات استان',
        category: 'foreign_trade',
        category_display: 'تجارت خارجی',
        value: '18.5',
        value_text: '',
        item_label: '',
        unit: 'میلیون دلار',
        statistical_year: 1403,
        period: 'annual',
        period_display: 'سالانه',
        period_number: null,
        source: 'گمرک جمهوری اسلامی ایران',
        source_url: 'https://example.com/tehran-export',
        source_published_at: '2025-01-01',
        collected_at: '2025-02-01',
        notes: '',
      },
    ]
    const fetchMock = vi.fn().mockImplementation(async (input: string) => {
      let payload: unknown = {}
      if (input.includes('/statistics/indicators/')) {
        payload = [
          {
            value: 'export_value',
            label: 'ارزش صادرات استان',
            category: 'foreign_trade',
            category_display: 'تجارت خارجی',
          },
        ]
      } else if (input.includes('/statistics/?')) {
        payload = [
          {
            ...tehranStatistics[1],
            id: 3,
            province_slug: 'isfahan',
            province_name_fa: 'اصفهان',
            value: '8.5',
          },
          {
            ...tehranStatistics[1],
            id: 4,
            province_slug: 'isfahan',
            province_name_fa: 'اصفهان',
            unit: 'تن',
            value: '999',
          },
        ]
      } else if (input.includes('/provinces/?country=IR')) {
        payload = [
          {
            id: 1,
            slug: 'tehran',
            name_fa: 'تهران',
            name_en: 'Tehran',
            is_published: true,
          },
          {
            id: 2,
            slug: 'isfahan',
            name_fa: 'اصفهان',
            name_en: 'Isfahan',
            is_published: true,
          },
        ]
      } else {
        payload = {
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
          capital: null,
          cities: [],
          industries: [],
          statistics: tehranStatistics,
        }
      }
      return { ok: true, status: 200, json: async () => payload }
    })
    vi.stubGlobal('fetch', fetchMock)

    renderWithProviders(
      <Routes>
        <Route path="/provinces/:slug/" element={<ProvinceDetailPage />} />
      </Routes>,
      { route: '/provinces/tehran/' },
    )

    expect(await screen.findAllByText('گمرک جمهوری اسلامی ایران')).toHaveLength(2)
    await userEvent.selectOptions(screen.getByLabelText('سال آماری'), '1403')
    await userEvent.selectOptions(screen.getByLabelText('استان برای مقایسه'), 'isfahan')

    expect(await screen.findByText('۸٫۵')).toBeInTheDocument()
    expect(screen.queryByText('999')).not.toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'نمودار روند تغییرات شاخص‌های ثبت‌شده' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/مشاهدهٔ منبع/)).toBeInTheDocument()
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
