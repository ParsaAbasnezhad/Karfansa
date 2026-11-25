import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { CompanyRegistration } from './CompanyRegistration'

function apiResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body }
}

describe('CompanyRegistration', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('validates each step and retains company details while moving back and forward', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input)
        if (url.includes('/v1/geography/provinces/'))
          return apiResponse([{ id: 1, name_fa: 'تهران' }])
        if (url.includes('/v1/geography/cities/'))
          return apiResponse([{ id: 2, name_fa: 'تهران', province_id: 1 }])
        return apiResponse({})
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<CompanyRegistration />)

    await user.click(screen.getByRole('button', { name: 'ادامه' }))
    expect(screen.getByText('نام رسمی شرکت باید دست‌کم ۲ نویسه باشد.')).toBeInTheDocument()
    await user.type(screen.getByLabelText(/نام رسمی/), 'شرکت نمونه')
    await user.type(screen.getByLabelText(/شناسه ملی/), '۱۲۳۴۵۶۷۸۹۰')
    await user.click(screen.getByRole('button', { name: 'ادامه' }))
    expect(screen.getByRole('heading', { name: 'ارتباط و نماینده' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'ادامه' }))
    expect(screen.getByText('شماره تماس شرکت را وارد کنید.')).toBeInTheDocument()
    expect(screen.getByText('استان محل فعالیت شرکت را انتخاب کنید.')).toBeInTheDocument()
    await user.type(screen.getByLabelText(/تلفن شرکت/), '۰۹۱۲۳۴۵۶۷۸۹')
    await waitFor(() => expect(screen.getByRole('option', { name: 'تهران' })).toBeInTheDocument())
    await user.selectOptions(screen.getByLabelText(/استان/), '1')
    await user.click(screen.getByRole('button', { name: 'ادامه' }))
    expect(screen.getByRole('heading', { name: 'مدارک و بازبینی' })).toBeInTheDocument()
    expect(screen.getByText('شرکت نمونه')).toBeInTheDocument()
    expect(screen.getByText('1234567890')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'مرحله قبل' }))
    expect(screen.getByLabelText(/تلفن شرکت/)).toHaveValue('09123456789')
    await user.click(screen.getByRole('button', { name: 'مرحله قبل' }))
    expect(screen.getByLabelText(/نام رسمی/)).toHaveValue('شرکت نمونه')
  })

  it('uploads a selected document and reuses the draft after a failed submission', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    document.cookie = 'csrftoken=company-test; path=/'
    let submitAttempts = 0
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/v1/geography/provinces/'))
        return apiResponse([{ id: 1, name_fa: 'تهران' }])
      if (url.includes('/v1/geography/cities/')) return apiResponse([])
      if (url.endsWith('/v1/business/organizations') && init?.method === 'POST')
        return apiResponse({ id: 'company-1' }, 201)
      if (url.endsWith('/v1/business/documents')) return apiResponse({ id: 9 }, 201)
      if (url.endsWith('/v1/business/organizations/company-1/submit')) {
        submitAttempts += 1
        return submitAttempts === 1
          ? apiResponse({ error: { message: 'لطفاً دوباره تلاش کنید.' } }, 503)
          : apiResponse({ verification_status: 'pending_review' })
      }
      return apiResponse({})
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderWithProviders(<CompanyRegistration />)
    await user.type(screen.getByLabelText(/نام رسمی/), 'شرکت نمونه')
    await user.click(screen.getByRole('button', { name: 'ادامه' }))
    await user.type(screen.getByLabelText(/تلفن شرکت/), '09123456789')
    await waitFor(() => expect(screen.getByRole('option', { name: 'تهران' })).toBeInTheDocument())
    await user.selectOptions(screen.getByLabelText(/استان/), '1')
    await user.click(screen.getByRole('button', { name: 'ادامه' }))

    const file = new File(['document'], 'registration.pdf', { type: 'application/pdf' })
    await user.upload(
      document.getElementById('company-file-registration') as HTMLInputElement,
      file,
    )
    expect(screen.getByText(/registration.pdf/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'ثبت و ارسال برای بررسی' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('لطفاً دوباره تلاش کنید.')
    expect(screen.getByText(/بارگذاری شد/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'ثبت و ارسال برای بررسی' }))
    expect(
      await screen.findByRole('heading', { name: 'ثبت شرکت با موفقیت انجام شد' }),
    ).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.filter(
        ([url, init]) =>
          String(url).endsWith('/v1/business/organizations') && init?.method === 'POST',
      ),
    ).toHaveLength(1)
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/v1/business/documents')),
    ).toHaveLength(1)
    expect(submitAttempts).toBe(2)
  })
})
