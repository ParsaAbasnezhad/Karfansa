import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authApi } from '@/api/auth'
import LoginPage, { credentialsSchema } from './LoginPage'

vi.mock('@/api/auth', () => ({ authApi: { login: vi.fn() } }))
vi.mock('./AuthProvider', () => ({ useAuth: () => ({ user: null, refresh: vi.fn() }) }))

describe('administrator login email validation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('accepts Django-supported single-label email domains', () => {
    expect(credentialsSchema.safeParse({ email: 'root@localhost', password: 'passphrase' }).success).toBe(true)
  })

  it('trims email whitespace before submitting credentials', () => {
    const result = credentialsSchema.safeParse({ email: '  root@example.com  ', password: 'passphrase' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBe('root@example.com')
  })

  it('continues to reject malformed email addresses', () => {
    expect(credentialsSchema.safeParse({ email: 'root@@localhost', password: 'passphrase' }).success).toBe(false)
  })

  it('shows field-level messages instead of a raw type error when fields are missing', () => {
    const result = credentialsSchema.safeParse({})
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual([
        'ایمیل معتبر وارد کنید.',
        'گذرواژه را وارد کنید.',
      ])
    }
  })

  it('rejects unexpected MFA challenges without showing OTP fields', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      mfa_required: true,
      mfa_setup_required: false,
    })
    render(<MemoryRouter><LoginPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText('ایمیل مدیریتی'), {
      target: { value: 'admin@localhost' },
    })
    fireEvent.change(screen.getByLabelText('گذرواژه'), {
      target: { value: 'correct horse battery staple' },
    })
    fireEvent.click(screen.getByRole('button', { name: /ورود به مرکز کنترل/ }))

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith('admin@localhost', 'correct horse battery staple')
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('ایمیل و گذرواژه')
    expect(screen.queryByLabelText('کد تأیید')).not.toBeInTheDocument()
  })

  it('finishes login without OTP when password authentication succeeds', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      mfa_required: false,
      mfa_setup_required: false,
      admin: { id: 1, email: 'admin@example.com', mfa_required: false },
    })
    render(<MemoryRouter><LoginPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText('ایمیل مدیریتی'), {
      target: { value: 'admin@example.com' },
    })
    fireEvent.change(screen.getByLabelText('گذرواژه'), {
      target: { value: 'correct horse battery staple' },
    })
    fireEvent.click(screen.getByRole('button', { name: /ورود به مرکز کنترل/ }))

    await waitFor(() => expect(authApi.login).toHaveBeenCalled())
    expect(screen.queryByLabelText('کد تأیید')).not.toBeInTheDocument()
  })
})
