import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { AccountPage } from './AccountPage'

const profile = {
  email: 'sara@example.com',
  phone: '+989121234567',
  first_name: '',
  last_name: '',
  date_joined: '2025-03-20T12:00:00Z',
  province_id: null,
  province_name: null,
  city_id: null,
  city_name: null,
}

describe('AccountPage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows member details and saves profile completion', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    document.cookie = 'csrftoken=account-test-token; path=/'
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/v1/auth/me') && init?.method === 'PATCH') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ...profile,
            first_name: 'سارا',
            last_name: 'احمدی',
            province_id: 1,
            province_name: 'تهران',
            city_id: 10,
            city_name: 'تهران',
          }),
        }
      }
      if (url.includes('/v1/geography/provinces/')) {
        return {
          ok: true,
          status: 200,
          json: async () => [{ id: 1, name_fa: 'تهران' }],
        }
      }
      if (url.includes('/v1/support/tickets')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            results: [],
            count: 0,
            page: 1,
            page_size: 4,
            total_pages: 0,
            summary: { total: 0, open: 0, waiting_for_user: 0, answered: 0, unread: 0 },
          }),
        }
      }
      if (url.includes('/v1/geography/cities/')) {
        return {
          ok: true,
          status: 200,
          json: async () => [{ id: 10, name_fa: 'تهران', province_id: 1 }],
        }
      }
      return { ok: true, status: 200, json: async () => profile }
    })
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<AccountPage />)

    expect(await screen.findByText('عضو از')).toBeInTheDocument()
    expect(screen.getByText('لیست شرکت‌ها')).toBeInTheDocument()
    expect(screen.getByText('ثبت خدمت‌دهنده')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('نام'), 'سارا')
    await userEvent.type(screen.getByLabelText('نام خانوادگی'), 'احمدی')
    await userEvent.selectOptions(await screen.findByLabelText('استان محل سکونت'), '1')
    await userEvent.selectOptions(await screen.findByLabelText('شهر محل سکونت'), '10')
    await userEvent.click(screen.getByRole('button', { name: 'ذخیره اطلاعات' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/auth/me',
        expect.objectContaining({ method: 'PATCH' }),
      )
    })
    expect(await screen.findByText('پروفایل تکمیل‌شده')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'تکمیل اطلاعات' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'اطلاعات حساب' })).not.toBeInTheDocument()
    expect(screen.getByText('تهران، تهران')).toBeInTheDocument()
  })

  it('uses active-business metrics without rendering account navigation', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const active = {
      kind: 'organization',
      id: 'org-1',
      label: 'شرکت آفتاب',
      role: 'owner',
      verification_status: 'verified',
      is_active_context: true,
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input)
        const responses: Record<string, unknown> = {
          '/v1/auth/me': {
            ...profile,
            first_name: 'سارا',
            last_name: 'احمدی',
            province_id: 1,
            province_name: 'تهران',
            city_id: 10,
            city_name: 'تهران',
          },
          '/v1/business/identities': { identities: [active], active },
          '/v1/business/dashboard': {
            ...active,
            rejection_reason: '',
            can_publish: true,
            can_edit_profile: true,
            can_submit_verification: false,
            can_manage_members: false,
            can_manage_trade: false,
            listings_total: 7,
            inquiries_new: 3,
            opportunities_total: 0,
          },
          '/v1/inquiries/notifications/list': { results: [], unread_count: 4 },
          '/v1/inquiries/received': { results: [] },
          '/v1/support/tickets/': {
            results: [],
            count: 0,
            page: 1,
            page_size: 4,
            total_pages: 0,
            summary: { total: 0, open: 0, waiting_for_user: 0, answered: 0, unread: 0 },
          },
          '/v1/geography/provinces/': [],
        }
        const path = new URL(url, window.location.origin).pathname.replace('/api', '')
        return {
          ok: true,
          status: 200,
          json: async () => responses[path] ?? [],
        }
      }),
    )
    renderWithProviders(<AccountPage />)

    expect(await screen.findByRole('heading', { name: 'خوش آمدید، سارا احمدی' })).toBeVisible()
    const metrics = within(screen.getByRole('region', { name: 'خلاصه فعالیت' }))
    await waitFor(() => {
      expect(screen.getAllByText('شرکت آفتاب').length).toBeGreaterThan(0)
      expect(metrics.getByText('۷')).toBeInTheDocument()
      expect(metrics.getByText('۳')).toBeInTheDocument()
      expect(metrics.getByText('۴')).toBeInTheDocument()
    })
    expect(
      screen.queryByRole('complementary', { name: 'ناوبری پنل کاربری' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'باز کردن منوی پنل' })).not.toBeInTheDocument()
  })

  it('shows the Control Center entry only for authorized administrators', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const openSpy = vi.fn()
    vi.stubGlobal('open', openSpy)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input)
        if (url.includes('/v1/auth/me')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ...profile,
              first_name: 'سارا',
              last_name: 'احمدی',
              province_id: 1,
              province_name: 'تهران',
              city_id: 10,
              city_name: 'تهران',
              control_center_access: true,
            }),
          }
        }
        if (url.includes('/v1/business/identities')) {
          return { ok: true, status: 200, json: async () => ({ identities: [], active: null }) }
        }
        if (url.includes('/v1/inquiries/')) {
          return { ok: true, status: 200, json: async () => ({ results: [], unread_count: 0 }) }
        }
        if (url.includes('/v1/support/tickets')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              results: [],
              count: 0,
              page: 1,
              page_size: 4,
              total_pages: 0,
              summary: { total: 0, open: 0, waiting_for_user: 0, answered: 0, unread: 0 },
            }),
          }
        }
        return { ok: true, status: 200, json: async () => ([]) }
      }),
    )
    renderWithProviders(<AccountPage />)

    const entry = await screen.findByRole('button', { name: /ورود به پنل مدیریت کارفانسا/ })
    expect(entry).toBeVisible()
    expect(screen.getByText('دسترسی به مرکز مدیریت و کنترل سامانه کارفانسا')).toBeInTheDocument()
    await userEvent.click(entry)
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringMatching(/127\.0\.0\.1:5174|console\.karfansa\.ir/),
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('hides the Control Center entry for ordinary users', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input)
        if (url.includes('/v1/auth/me')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ...profile,
              first_name: 'سارا',
              last_name: 'احمدی',
              province_id: 1,
              province_name: 'تهران',
              city_id: 10,
              city_name: 'تهران',
              control_center_access: false,
            }),
          }
        }
        if (url.includes('/v1/business/identities')) {
          return { ok: true, status: 200, json: async () => ({ identities: [], active: null }) }
        }
        if (url.includes('/v1/inquiries/')) {
          return { ok: true, status: 200, json: async () => ({ results: [], unread_count: 0 }) }
        }
        if (url.includes('/v1/support/tickets')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              results: [],
              count: 0,
              page: 1,
              page_size: 4,
              total_pages: 0,
              summary: { total: 0, open: 0, waiting_for_user: 0, answered: 0, unread: 0 },
            }),
          }
        }
        return { ok: true, status: 200, json: async () => ([]) }
      }),
    )
    renderWithProviders(<AccountPage />)
    expect(await screen.findByText('خوش آمدید، سارا احمدی')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ورود به پنل مدیریت کارفانسا/ })).not.toBeInTheDocument()
  })

  it('shows a login prompt when there is no authenticated session', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => ({ message: 'وارد حساب کاربری نشده‌اید.' }),
      })),
    )
    renderWithProviders(<AccountPage />)

    expect(await screen.findByRole('heading', { name: 'برای دیدن پنل وارد شوید' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'ورود به حساب' })).toHaveAttribute('href', '/login/')
  })
})
