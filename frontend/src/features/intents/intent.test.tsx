import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { AccountPage } from '@/features/account/AccountPage'
import { HomeIntentSection } from './HomeIntentSection'
import { IntentDialog } from './IntentDialog'
import { GUEST_INTENT_KEY } from './intent'

function response(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body }
}

describe('user intent experience', () => {
  beforeEach(() => {
    localStorage.clear()
    document.cookie = 'csrftoken=intent-test; path=/'
    vi.stubEnv('VITE_USE_MOCK', 'false')
  })

  it('saves a guest choice, collapses the form, and keeps it hidden on refresh', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/v1/auth/me')) return response(401, { message: 'signed out' })
      if (url.includes('/v1/intents/guest')) return response(201, { saved: true })
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    const first = renderWithProviders(<HomeIntentSection />)
    await screen.findByRole('heading', { name: 'با چه هدفی به کارفنسا آمده‌اید؟' })
    await userEvent.click(screen.getByRole('radio', { name: /صاحب شرکت هستم/ }))
    await userEvent.click(screen.getByRole('button', { name: 'ثبت هدف من' }))
    expect(await screen.findByText('هدف شما ثبت شد')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('هدف شما ثبت شد')).not.toBeInTheDocument(), {
      timeout: 2200,
    })
    const saved = JSON.parse(localStorage.getItem(GUEST_INTENT_KEY) ?? '{}')
    expect(saved.saved).toBe(true)
    expect(saved.goals).toEqual(['company_owner'])
    const submission = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/v1/intents/guest'),
    )
    expect(JSON.parse(String(submission?.[1]?.body)).contact_phone).toBe('')
    first.unmount()
    renderWithProviders(<HomeIntentSection />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(
      screen.queryByRole('heading', { name: 'با چه هدفی به کارفنسا آمده‌اید؟' }),
    ).not.toBeInTheDocument()
  })

  it('keeps the form and local state unsubmitted when the backend fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) =>
        String(input).includes('/v1/auth/me')
          ? response(401, { message: 'signed out' })
          : response(503, { error: { message: 'ثبت موقتاً ممکن نیست.' } }),
      ),
    )
    renderWithProviders(<HomeIntentSection />)
    await screen.findByRole('heading', { name: 'با چه هدفی به کارفنسا آمده‌اید؟' })
    await userEvent.click(screen.getByRole('radio', { name: /محصول یا خدمات دارم/ }))
    await userEvent.click(screen.getByRole('button', { name: 'ثبت هدف من' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('ثبت موقتاً ممکن نیست.')
    expect(
      screen.getByRole('heading', { name: 'با چه هدفی به کارفنسا آمده‌اید؟' }),
    ).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(GUEST_INTENT_KEY) ?? '{}').saved).toBe(false)
  })

  it('validates mobile locally and normalizes Persian digits before sending', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, _init?: RequestInit) =>
      String(input).includes('/v1/auth/me')
        ? response(401, { message: 'signed out' })
        : response(201, { saved: true }),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<HomeIntentSection />)
    await screen.findByRole('heading', { name: 'با چه هدفی به کارفنسا آمده‌اید؟' })
    await userEvent.click(screen.getByRole('radio', { name: /فرصت تجاری دارم/ }))
    const mobile = screen.getByLabelText(/شماره موبایل شما/)
    await userEvent.type(mobile, '12345')
    await userEvent.click(screen.getByRole('button', { name: 'ثبت هدف من' }))
    expect(screen.getByRole('alert')).toHaveTextContent('شماره موبایل ایرانی معتبر')
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/v1/intents/guest'))).toBe(
      false,
    )
    await userEvent.clear(mobile)
    await userEvent.type(mobile, '۰۹۱۲۳۴۵۶۷۸۹')
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'ثبت هدف من' }))
    expect(await screen.findByText('هدف شما ثبت شد')).toBeInTheDocument()
    const submission = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/v1/intents/guest'),
    )
    const sent = JSON.parse(String(submission?.[1]?.body))
    expect(sent.contact_phone).toBe('09123456789')
    expect(sent.contact_consent).toBe(true)
  })

  it('never flashes the form for an account with a saved backend intent', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('/v1/auth/me')) return response(200, { email: 'user@example.invalid' })
      if (url.includes('/v1/intents/me'))
        return response(200, {
          has_intent: true,
          goals: ['offering'],
          contact_phone: '',
          contact_consent: false,
          created_at: '2026-11-21T00:00:00Z',
        })
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<HomeIntentSection />)
    expect(
      screen.queryByRole('heading', { name: 'با چه هدفی به کارفنسا آمده‌اید؟' }),
    ).not.toBeInTheDocument()
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/v1/intents/me'))).toBe(
        true,
      ),
    )
    expect(
      screen.queryByRole('heading', { name: 'با چه هدفی به کارفنسا آمده‌اید؟' }),
    ).not.toBeInTheDocument()
  })

  it('edits multiple goals in the profile and keeps exploring exclusive', async () => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.setAttribute('open', '')
      },
    })
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.removeAttribute('open')
      },
    })
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'PUT') {
        return response(200, {
          has_intent: true,
          goals: JSON.parse(String(init.body)).goals,
          contact_phone: '',
          contact_consent: false,
          created_at: '2026-11-21T00:00:00Z',
        })
      }
      if (url.includes('/v1/intents/me'))
        return response(200, {
          has_intent: true,
          goals: ['company_owner'],
          contact_phone: '',
          contact_consent: false,
          created_at: '2026-11-21T00:00:00Z',
        })
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<IntentDialog open onClose={() => {}} userEmail="user@example.invalid" />)
    await screen.findByRole('checkbox', { name: /صاحب شرکت هستم/ })
    await userEvent.click(screen.getByRole('checkbox', { name: /برای آشنایی و بررسی آمده‌ام/ }))
    expect(screen.getByRole('checkbox', { name: /صاحب شرکت هستم/ })).not.toBeChecked()
    await userEvent.click(screen.getByRole('checkbox', { name: /محصول یا خدمات دارم/ }))
    expect(screen.getByRole('checkbox', { name: /برای آشنایی و بررسی آمده‌ام/ })).not.toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: 'ذخیره تغییرات' }))
    expect(await screen.findByText('هدف‌های شما ذخیره شد.')).toBeInTheDocument()
    const update = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')
    expect(JSON.parse(String(update?.[1]?.body)).goals).toEqual(['offering'])
  })

  it('keeps the intent management action in a completed private profile', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input)
        if (url.includes('/v1/auth/me'))
          return response(200, {
            email: 'user@example.invalid',
            phone: '09121112233',
            first_name: 'سارا',
            last_name: 'احمدی',
            date_joined: '2026-01-01T00:00:00Z',
            province_id: 1,
            province_name: 'تهران',
            city_id: 1,
            city_name: 'تهران',
          })
        if (url.includes('/v1/geography/')) return response(200, [])
        if (url.includes('/v1/support/tickets/'))
          return response(200, { results: [], summary: { unread: 0 } })
        throw new Error(`Unexpected request: ${url}`)
      }),
    )
    renderWithProviders(<AccountPage />)
    expect(await screen.findByRole('button', { name: /هدف من در کارفنسا/ })).toBeInTheDocument()
  })
})
