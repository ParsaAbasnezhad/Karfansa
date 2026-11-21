import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { JoinPage } from './JoinPage'

describe('JoinPage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows company and individual choices for a signed-in user', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    document.cookie = 'csrftoken=join-test; path=/'
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input)
        if (url.includes('/v1/auth/me')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              email: 'sara@example.com',
              phone: '09120000000',
              first_name: 'سارا',
              last_name: 'احمدی',
              date_joined: '2026-01-01T00:00:00Z',
              province_id: null,
              province_name: null,
              city_id: null,
              city_name: null,
            }),
          }
        }
        return { ok: true, status: 200, json: async () => ({ identities: [], active: null }) }
      }),
    )
    renderWithProviders(<JoinPage />)
    const company = await screen.findByRole('button', { name: (value) => value.startsWith('ثبت شرکت') })
    expect(screen.getByRole('button', { name: (value) => value.startsWith('فعالیت فردی') })).toBeInTheDocument()
    await userEvent.click(company)
    expect(screen.getByLabelText('نام رسمی')).toBeInTheDocument()
    expect(screen.getByLabelText('شناسه ملی')).toBeInTheDocument()
  })

  it('keeps password confirmation errors on the account step', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'وارد حساب کاربری نشده‌اید.' } }),
      })),
    )
    renderWithProviders(<JoinPage />)
    expect(await screen.findByRole('heading', { name: 'ساخت حساب' })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('نام'), 'سارا')
    await userEvent.type(screen.getByLabelText('نام خانوادگی'), 'احمدی')
    await userEvent.type(screen.getByLabelText('شماره موبایل'), '09120000000')
    await userEvent.type(screen.getByLabelText('ایمیل'), 'sara@example.com')
    await userEvent.type(screen.getByLabelText('گذرواژه'), 'Qw9!sX4mN2#kL7pV')
    await userEvent.type(screen.getByLabelText('تکرار گذرواژه'), 'different-password')
    await userEvent.click(screen.getByRole('button', { name: 'دریافت کد تأیید' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('گذرواژه و تکرار آن یکسان نیستند.')
  })
})
