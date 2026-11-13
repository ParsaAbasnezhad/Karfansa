import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { SupportCenterPage } from './SupportCenterPage'

const profile = {
  email: 'sara@example.com',
  phone: '+989121234567',
  first_name: 'سارا',
  last_name: 'احمدی',
  date_joined: '2025-03-20T12:00:00Z',
  province_id: 1,
  province_name: 'تهران',
  city_id: 10,
  city_name: 'تهران',
}

describe('SupportCenterPage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('lists tickets and submits a new support request', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    document.cookie = 'csrftoken=support-test-token; path=/'
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/v1/support/tickets/') && init?.method === 'POST') {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            ticket_number: 'KF-20261113-ABC123',
            access_token: null,
            message: 'درخواست پشتیبانی ثبت شد.',
          }),
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
            page_size: 8,
            total_pages: 0,
            summary: { total: 0, open: 0, waiting_for_user: 0, answered: 0, unread: 0 },
          }),
        }
      }
      return { ok: true, status: 200, json: async () => profile }
    })
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<SupportCenterPage />, { route: '/account/support?new=1' })

    expect(
      await screen.findByRole('heading', { name: 'درخواست‌های پشتیبانی شما' }),
    ).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('موضوع'), 'خطا در ورود')
    await userEvent.selectOptions(screen.getByLabelText('دسته‌بندی'), 'technical')
    await userEvent.type(
      screen.getByLabelText('شرح درخواست'),
      'نمی‌توانم وارد حساب کاربری شوم و خطا می‌بینم.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'ارسال درخواست' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/support/tickets/',
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })
})
