import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { BusinessDashboardPage } from './BusinessDashboardPage'

const company = {
  kind: 'organization',
  id: 'org-1',
  label: 'شرکت آفتاب',
  role: 'owner',
  verification_status: 'verified',
}
const individual = {
  kind: 'individual',
  id: 'person-1',
  label: 'سارا احمدی',
  role: 'owner',
  verification_status: 'verified',
}

const listing = (id: number, title: string) => ({
  id,
  title,
  status: 'approved',
  listing_kind: 'product',
  is_active: true,
  created_at: '2026-11-20T12:00:00Z',
})
const inquiry = (id: number, listingId: number, title: string) => ({
  id,
  listing_id: listingId,
  listing_title: title,
  listing_slug: `listing-${listingId}`,
  buyer_name: 'خریدار آزمایشی',
  message: `پیام ${title}`,
  status: 'new',
  status_display: 'جدید',
  created_at: '2026-11-21T12:00:00Z',
})

describe('BusinessDashboardPage identity isolation', () => {
  it('shows inquiries only for the active identity and refreshes them after a switch', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    document.cookie = 'csrftoken=business-test; path=/'
    let active = company
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      let data: unknown
      if (url.endsWith('/v1/auth/me')) {
        data = {
          email: 'sara@example.com',
          phone: '09120000000',
          first_name: 'سارا',
          last_name: 'احمدی',
          date_joined: '2026-01-01T00:00:00Z',
          province_id: null,
          province_name: null,
          city_id: null,
          city_name: null,
        }
      } else if (url.endsWith('/v1/business/identities')) {
        data = {
          identities: [company, individual].map((identity) => ({
            ...identity,
            is_active_context: identity.id === active.id,
          })),
          active: { ...active, is_active_context: true },
        }
      } else if (url.endsWith('/v1/business/identity') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { kind: string; id: string }
        active = body.id === individual.id ? individual : company
        data = { active: { ...active, is_active_context: true } }
      } else if (url.endsWith('/v1/business/dashboard')) {
        data = {
          ...active,
          rejection_reason: '',
          can_publish: true,
          can_edit_profile: false,
          can_submit_verification: false,
          can_manage_members: false,
          can_manage_trade: false,
          listings_total: 1,
          inquiries_new: 1,
          opportunities_total: 0,
        }
      } else if (url.includes('/v1/business/listings?')) {
        data = {
          results:
            active.id === company.id
              ? [listing(101, 'محصول شرکت آفتاب')]
              : [listing(202, 'محصول سارا')],
          count: 1,
        }
      } else if (url.endsWith('/v1/services/inquiries/received')) {
        // The API can return inquiries for every identity owned by the account.
        data = [inquiry(1, 101, 'محصول شرکت آفتاب'), inquiry(2, 202, 'محصول سارا')]
      } else if (url.endsWith('/v1/services/inquiries/submitted')) {
        data = []
      } else if (url.endsWith('/v1/business/organizations/org-1')) {
        data = { name: company.label, province_id: 1, phone: '02112345678', is_active: true }
      } else if (url.endsWith('/v1/business/individual')) {
        data = { display_name: individual.label }
      } else {
        throw new Error(`Unexpected request: ${url}`)
      }
      return { ok: true, status: 200, json: async () => data }
    })
    vi.stubGlobal('fetch', fetchMock)

    renderWithProviders(<BusinessDashboardPage />, { route: '/business?section=inquiries' })
    const inquiries = (await screen.findAllByRole('heading', { name: 'درخواست‌های مشتریان' })).find(
      (heading) => heading.closest('section'),
    )
    expect(inquiries).toBeDefined()
    await waitFor(() => {
      expect(
        within(inquiries!.closest('section') as HTMLElement).getByText('محصول شرکت آفتاب'),
      ).toBeVisible()
    })
    expect(screen.queryByText('محصول سارا')).not.toBeInTheDocument()

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'تعویض هویت فعال' }),
      'individual:person-1',
    )
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/business/identity',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ kind: 'individual', id: 'person-1' }),
        }),
      )
      expect(screen.getByRole('combobox', { name: 'تعویض هویت فعال' })).toHaveValue(
        'individual:person-1',
      )
      expect(screen.getAllByText('محصول سارا').length).toBeGreaterThan(0)
      expect(screen.queryByText('محصول شرکت آفتاب')).not.toBeInTheDocument()
    })
  })

  it('shows a setup action when the account has no business identity', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input)
        let data: unknown
        if (url.endsWith('/v1/auth/me')) {
          data = {
            email: 'sara@example.com',
            phone: '09120000000',
            first_name: 'سارا',
            last_name: 'احمدی',
          }
        } else if (url.endsWith('/v1/business/identities')) {
          data = { identities: [], active: null }
        } else if (url.endsWith('/v1/business/dashboard')) {
          data = {
            kind: '',
            id: '',
            label: '',
            role: null,
            verification_status: '',
            rejection_reason: '',
            can_publish: false,
            can_edit_profile: false,
            can_submit_verification: false,
            can_manage_members: false,
            can_manage_trade: false,
            listings_total: 0,
            inquiries_new: 0,
            opportunities_total: 0,
          }
        } else {
          throw new Error(`Unexpected request: ${url}`)
        }
        return { ok: true, status: 200, json: async () => data }
      }),
    )

    renderWithProviders(<BusinessDashboardPage />, { route: '/business' })
    expect(await screen.findByText('هنوز هویتی ثبت نشده')).toBeVisible()
    expect(screen.getByRole('link', { name: 'ایجاد هویت' })).toHaveAttribute('href', '/join')
    expect(screen.queryByText('محصولات فعال')).not.toBeInTheDocument()
  })

  it('keeps publishing actions unavailable for a suspended company', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input)
        let data: unknown
        if (url.endsWith('/v1/auth/me')) {
          data = {
            email: 'sara@example.com',
            phone: '09120000000',
            first_name: 'سارا',
            last_name: 'احمدی',
          }
        } else if (url.endsWith('/v1/business/identities')) {
          data = {
            identities: [{ ...company, verification_status: 'suspended', is_active_context: true }],
            active: { ...company, verification_status: 'suspended', is_active_context: true },
          }
        } else if (url.endsWith('/v1/business/dashboard')) {
          data = {
            ...company,
            verification_status: 'suspended',
            rejection_reason: '',
            can_publish: false,
            can_edit_profile: false,
            can_submit_verification: false,
            can_manage_members: false,
            can_manage_trade: false,
            listings_total: 0,
            inquiries_new: 0,
            opportunities_total: 0,
          }
        } else if (url.includes('/v1/business/listings?')) {
          data = { results: [], count: 0 }
        } else if (url.endsWith('/v1/services/inquiries/received')) {
          data = []
        } else if (url.endsWith('/v1/business/organizations/org-1')) {
          data = { name: company.label, province_id: 1, phone: '02112345678', is_active: false }
        } else {
          throw new Error(`Unexpected request: ${url}`)
        }
        return { ok: true, status: 200, json: async () => data }
      }),
    )

    renderWithProviders(<BusinessDashboardPage />, { route: '/business' })
    expect((await screen.findAllByText('تعلیق‌شده')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: 'افزودن محصول' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'افزودن خدمت' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ثبت فرصت تجاری' })).not.toBeInTheDocument()
  })

  it('shows a loading skeleton and a retry action when the dashboard API fails', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input)
        if (url.endsWith('/v1/auth/me'))
          return {
            ok: true,
            status: 200,
            json: async () => ({
              email: 'sara@example.com',
              phone: '',
              first_name: 'سارا',
              last_name: 'احمدی',
            }),
          }
        if (url.endsWith('/v1/business/identities'))
          return {
            ok: true,
            status: 200,
            json: async () => ({
              identities: [{ ...company, is_active_context: true }],
              active: { ...company, is_active_context: true },
            }),
          }
        if (url.endsWith('/v1/business/dashboard'))
          return {
            ok: false,
            status: 503,
            json: async () => ({ error: { message: 'سرویس موقتاً در دسترس نیست' } }),
          }
        throw new Error(`Unexpected request: ${url}`)
      }),
    )

    renderWithProviders(<BusinessDashboardPage />, { route: '/business' })
    expect(screen.getByLabelText('در حال بارگذاری داشبورد')).toHaveAttribute('aria-busy', 'true')
    expect(await screen.findByRole('heading', { name: 'داشبورد در دسترس نیست' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'تلاش دوباره' })).toBeVisible()
  })
})
