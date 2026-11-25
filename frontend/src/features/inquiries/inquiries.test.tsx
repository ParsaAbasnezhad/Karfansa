import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { InquiryActions } from './InquiryActions'
import { InquiryDashboardPage } from './InquiryDashboardPage'

function response(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body }
}

const account = {
  email: 'applicant@example.com', phone: '09120000000', first_name: 'سارا',
  last_name: 'احمدی', date_joined: '2026-01-01T00:00:00Z',
  province_id: null, province_name: null, city_id: null, city_name: null,
}

const inquiry = {
  public_id: 'dc519713-b7b4-4cad-96b8-ec3dfb0a628a', target_type: 'trade',
  target_title: 'فرصت صادرات خرما', target_url: '/trade/date', owner_name: 'شرکت آفتاب',
  applicant_name: 'سارا احمدی', category: 'partnership', subject: 'همکاری صادراتی',
  message: 'برای همکاری در صادرات خرما آماده هستم.', status: 'new',
  status_display: 'جدید', created_at: '2026-11-20T12:00:00Z',
  last_activity_at: '2026-11-20T12:00:00Z', unread: true,
}

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  document.cookie = 'csrftoken=inquiry-test; path=/'
  sessionStorage.clear()
})

describe('collaboration request', () => {
  it('shows success only after persistence and sends a single request for repeated clicks', async () => {
    let finish!: (value: ReturnType<typeof response>) => void
    const pending = new Promise<ReturnType<typeof response>>((resolve) => { finish = resolve })
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/v1/auth/me')) return response(200, account)
      if (url.endsWith('/v1/inquiries/') && init?.method === 'POST') return pending
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<InquiryActions targetType="trade" slug="date" title="فرصت صادرات خرما" ownerName="شرکت آفتاب" />, { route: '/trade/date' })
    await userEvent.click(await screen.findByRole('button', { name: /درخواست همکاری/ }))
    const dialog = screen.getByRole('dialog')
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'موضوع' }), 'همکاری صادراتی')
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'شرح درخواست' }), 'برای همکاری در صادرات خرما آماده هستم.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'ثبت و ارسال درخواست' }))
    expect(screen.queryByText('درخواست شما ثبت شد')).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'در حال ثبت…' })).toBeDisabled()
    finish(response(201, inquiry))
    expect(await screen.findByText('درخواست شما ثبت شد')).toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/v1/inquiries/'))).toHaveLength(1)
  })

  it('shows only returned public contact channels and an empty state', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/v1/auth/me')) return response(200, account)
      if (url.includes('/v1/inquiries/contact/')) return response(200, { owner_name: 'شرکت آفتاب', channels: [] })
      throw new Error(`Unexpected request: ${url}`)
    }))
    renderWithProviders(<InquiryActions targetType="trade" slug="date" title="فرصت صادرات خرما" ownerName="شرکت آفتاب" />)
    await userEvent.click(screen.getByRole('button', { name: 'ارتباط مستقیم' }))
    expect(await screen.findByText('راه تماس عمومی برای این منتشرکننده ثبت نشده است.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'تلگرام' })).not.toBeInTheDocument()
  })
})

describe('inquiry dashboard', () => {
  it('shows responsive filters, paginated rows, and the authorized detail', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/v1/auth/me')) return response(200, account)
      if (url.includes('/v1/inquiries/received')) return response(200, {
        results: [inquiry], count: 1, page: 1, page_size: 20, total_pages: 1,
        summary: { total: 1, new: 1, reviewing: 0, accepted: 0, rejected: 0 },
      })
      if (url.endsWith(`/v1/inquiries/${inquiry.public_id}`)) return response(200, {
        ...inquiry, viewer_role: 'owner', messages: [], status_events: [],
      })
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<InquiryDashboardPage />, { route: '/account/inquiries' })
    expect(await screen.findByRole('button', { name: /فرصت صادرات خرما/ })).toBeInTheDocument()
    const filterButton = screen.getByRole('button', { name: /فیلترها/ })
    await userEvent.click(filterButton)
    expect(filterButton).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(screen.getByRole('button', { name: /سارا احمدی/ }))
    expect(await screen.findByText('شرح درخواست')).toBeInTheDocument()
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith(`/v1/inquiries/${inquiry.public_id}`))).toBe(true))
  })
})
