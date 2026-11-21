import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { AboutPage } from './AboutPage'
import { ContactPage } from './ContactPage'

describe('About and contact pages', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('shows live counts from public APIs and links to active sections', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe() {}
        disconnect() {}
      },
    )
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        const data = url.includes('/home/about/')
          ? {
              hero_title: 'تجارت، از اطلاعات روشن آغاز می‌شود.',
              hero_intro: 'معرفی کارفنسا',
              story_title: 'داستان ویرایش‌پذیر کارفنسا',
              story_body: 'محتوای معرفی',
              mission_title: 'مأموریت',
              mission_body: 'متن مأموریت',
              vision_title: 'چشم‌انداز',
              vision_body: 'متن چشم‌انداز',
            }
          : { count: url.includes('/trade/') ? 7 : url.includes('/services/') ? 4 : 12 }
        return Promise.resolve(
          new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }),
    )

    renderWithProviders(<AboutPage />)

    expect(await screen.findByLabelText('۷')).toBeInTheDocument()
    expect(screen.queryByText('خبرهای در دسترس')).not.toBeInTheDocument()
    expect(vi.mocked(fetch).mock.calls.every(([url]) => !String(url).includes('/news/'))).toBe(true)
    expect(
      await screen.findByRole('heading', { name: 'داستان ویرایش‌پذیر کارفنسا' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /اطلاعات روشن/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /فرصت‌های تجاری/ })).toHaveAttribute('href', '/trade/')
    expect(screen.getByRole('link', { name: /بازار محصولات/ })).toHaveAttribute(
      'href',
      '/services/',
    )
  })

  it('submits contact messages to the API and confirms the result', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (String(url).includes('/auth/me')) {
          return Promise.resolve(
            new Response(JSON.stringify({ message: 'وارد حساب کاربری نشده‌اید.' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
        const data = url.endsWith('/auth/csrf')
          ? { message: 'test-csrf-token' }
          : {
              message: 'پیام شما با موفقیت ثبت شد.',
              ticket_number: 'KF-20260101-ABC123',
              access_token: 'guest-token',
            }
        return Promise.resolve(
          new Response(JSON.stringify(data), {
            status: url.endsWith('/auth/csrf') ? 200 : 201,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<ContactPage />)

    await user.type(screen.getByLabelText(/نام و نام خانوادگی/), 'کاربر نمونه')
    await user.type(screen.getByLabelText(/شماره موبایل/), '09123456789')
    await user.type(screen.getByLabelText(/ایمیل/), 'user@example.com')
    await user.selectOptions(screen.getByLabelText(/موضوع پیام/), 'پشتیبانی فنی')
    await user.type(screen.getByLabelText(/متن پیام/), 'برای پیگیری محصول پیام می‌فرستم.')
    await user.click(screen.getByRole('button', { name: 'ارسال پیام' }))

    expect(await screen.findByText('پیام شما با موفقیت ثبت شد.')).toBeInTheDocument()
    const requests = vi.mocked(fetch).mock.calls
    const submission = requests.find(([url]) => String(url).endsWith('/v1/contact/'))
    expect(submission).toBeDefined()
    expect(JSON.parse(String((submission?.[1] as RequestInit).body))).toMatchObject({
      name: 'کاربر نمونه',
      phone: '+989123456789',
      email: 'user@example.com',
      subject: 'پشتیبانی فنی',
    })
  })

  it('shows field-level validation errors before sending a contact message', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContactPage />)

    await user.type(screen.getByLabelText(/نام و نام خانوادگی/), 'کاربر نمونه')
    await user.type(screen.getByLabelText(/شماره موبایل/), '123')
    await user.click(screen.getByRole('button', { name: 'ارسال پیام' }))

    expect(await screen.findByText('شماره موبایل معتبر وارد کنید.')).toHaveAttribute(
      'id',
      'contact-phone-error',
    )
    expect(screen.getByLabelText(/شماره موبایل/)).toHaveAttribute('aria-invalid', 'true')
  })
})
