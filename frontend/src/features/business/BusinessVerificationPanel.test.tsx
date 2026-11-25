import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { BusinessVerificationPanel } from './BusinessVerificationPanel'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  document.cookie = 'csrftoken=; Max-Age=0; path=/'
})

describe('BusinessVerificationPanel', () => {
  it('shows review feedback and uploads a private document without changing the existing flow', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    document.cookie = 'csrftoken=verification-test; path=/'
    const docs: {
      id: number
      document_type: string
      review_status: string
      rejection_reason: string
      created_at: string
    }[] = [
      {
        id: 17,
        document_type: 'registration',
        review_status: 'rejected',
        rejection_reason: 'تصویر واضح نیست؛ نسخه خواناتر بارگذاری کنید.',
        created_at: '2026-11-20T12:00:00Z',
      },
    ]
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/v1/business/documents?')) {
        return { ok: true, status: 200, json: async () => docs }
      }
      if (url.endsWith('/v1/business/documents') && init?.method === 'POST') {
        const body = init.body as FormData
        expect(body.get('kind')).toBe('organization')
        expect(body.get('identity_id')).toBe('org-1')
        expect(body.get('document_type')).toBe('registration')
        expect(body.get('upload')).toMatchObject({ name: 'registration.pdf' })
        docs.unshift({
          id: 18,
          document_type: 'registration',
          review_status: 'pending',
          rejection_reason: '',
          created_at: '2026-11-24T12:00:00Z',
        })
        return { ok: true, status: 201, json: async () => docs[0] }
      }
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderWithProviders(
      <BusinessVerificationPanel
        kind="organization"
        id="org-1"
        canSubmit
        verificationStatus="rejected"
        rejectionReason="اطلاعات ثبت‌شده با مدرک هم‌خوانی ندارد."
        completion={80}
        profileReady
        onEditProfile={vi.fn()}
      />,
    )

    expect(await screen.findByText('اطلاعات ثبت‌شده با مدرک هم‌خوانی ندارد.')).toBeVisible()
    expect(await screen.findByText('تصویر واضح نیست؛ نسخه خواناتر بارگذاری کنید.')).toBeVisible()
    expect(screen.getByRole('link', { name: 'دریافت آگهی ثبت' })).toHaveAttribute(
      'href',
      '/api/v1/business/documents/17/file',
    )
    expect(await screen.findByText('ارسال نسخه اصلاح‌شده')).toBeVisible()

    const file = new File(['document'], 'registration.pdf', { type: 'application/pdf' })
    await userEvent.upload(screen.getByLabelText('انتخاب فایل'), file)
    await userEvent.click(screen.getByRole('button', { name: 'بارگذاری مدرک' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/business/documents',
        expect.objectContaining({ method: 'POST' }),
      )
    })
    expect(await screen.findByText('مدرک با موفقیت بارگذاری شد.')).toBeVisible()
    expect(await screen.findByText('در انتظار بررسی')).toBeVisible()
  })

  it('submits a complete individual identity using its existing API endpoint', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    document.cookie = 'csrftoken=verification-test; path=/'
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/v1/business/documents?')) {
        return { ok: true, status: 200, json: async () => [] }
      }
      if (url.endsWith('/v1/business/individual/submit') && init?.method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ verification_status: 'pending_review' }),
        }
      }
      if (url.endsWith('/v1/business/identities')) {
        return { ok: true, status: 200, json: async () => ({ identities: [], active: null }) }
      }
      if (url.endsWith('/v1/business/dashboard')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ verification_status: 'pending_review' }),
        }
      }
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderWithProviders(
      <BusinessVerificationPanel
        kind="individual"
        id="person-1"
        canSubmit
        verificationStatus="draft"
        rejectionReason=""
        completion={100}
        profileReady
        onEditProfile={vi.fn()}
      />,
    )

    await userEvent.click(await screen.findByRole('button', { name: 'ارسال برای بررسی' }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/business/individual/submit',
        expect.objectContaining({ method: 'POST' }),
      )
    })
    expect(await screen.findByText('درخواست بررسی با موفقیت ثبت شد.')).toBeVisible()
  })
})
