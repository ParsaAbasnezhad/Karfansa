import { screen, waitFor } from '@testing-library/react'
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

    expect(await screen.findByText('عضو کارفنسا از')).toBeInTheDocument()
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
