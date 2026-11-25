import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { ProfilePanel } from './BusinessForms'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  document.cookie = 'csrftoken=; Max-Age=0; path=/'
})

describe('ProfilePanel', () => {
  it('edits a company profile and uploads a replacement image', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    document.cookie = 'csrftoken=profile-test; path=/'
    const company = {
      name: 'شرکت آفتاب',
      organization_type: 'trading',
      national_id: '12345',
      registration_number: '876',
      economic_code: '',
      ceo_name: '',
      representative_name: '',
      representative_phone: '',
      phone: '02112345678',
      email: '',
      website: '',
      address: '',
      description: '',
      province_id: 1,
      verification_status: 'pending_review',
    }
    let updatedPhone = company.phone
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/v1/business/organizations/org-1')) {
        if (init?.method === 'PATCH') {
          const body = JSON.parse(String(init.body)) as { phone: string }
          updatedPhone = body.phone
          return {
            ok: true,
            status: 200,
            json: async () => ({ ...company, phone: updatedPhone }),
          }
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ ...company, phone: updatedPhone }),
        }
      }
      if (url.includes('/v1/geography/provinces/')) {
        return { ok: true, status: 200, json: async () => [{ id: 1, name_fa: 'تهران' }] }
      }
      if (url.endsWith('/v1/business/organizations/org-1/image') && init?.method === 'POST') {
        const body = init.body as FormData
        expect(body.get('slot')).toBe('logo')
        expect(body.get('upload')).toMatchObject({ name: 'logo.png' })
        return { ok: true, status: 200, json: async () => company }
      }
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    renderWithProviders(
      <ProfilePanel
        kind="organization"
        id="org-1"
        completion={60}
        checklist={[
          { label: 'نام رسمی شرکت', done: true },
          { label: 'استان فعالیت', done: true },
          { label: 'شماره تماس', done: true },
        ]}
      />,
    )

    expect(await screen.findByText('شرکت آفتاب')).toBeVisible()
    expect(screen.getByText('در انتظار بررسی')).toBeVisible()
    await user.click(screen.getByText('تماس و نماینده'))
    const phone = screen.getByLabelText('تلفن شرکت')
    await user.clear(phone)
    await user.type(phone, '02199887766')
    await user.click(screen.getByRole('button', { name: 'ذخیره اطلاعات' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/business/organizations/org-1',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('"phone":"02199887766"'),
        }),
      )
    })
    expect(await screen.findByText('اطلاعات ذخیره شد.')).toBeVisible()

    const file = new File(['image'], 'logo.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('انتخاب تصویر'), file)
    await user.click(screen.getByRole('button', { name: 'بارگذاری تصویر' }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/business/organizations/org-1/image',
        expect.objectContaining({ method: 'POST' }),
      )
    })
    expect(await screen.findByText('تصویر ذخیره شد.')).toBeVisible()
  })

  it('renders the individual profile fields without company-only data', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input)
        if (url.endsWith('/v1/business/individual')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              display_name: 'سارا احمدی',
              professional_title: 'مشاور',
              province_id: 1,
              verification_status: 'verified',
            }),
          }
        }
        if (url.includes('/v1/geography/provinces/')) {
          return { ok: true, status: 200, json: async () => [{ id: 1, name_fa: 'تهران' }] }
        }
        throw new Error(`Unexpected request: ${url}`)
      }),
    )

    renderWithProviders(
      <ProfilePanel
        kind="individual"
        id="person-1"
        completion={60}
        checklist={[{ label: 'نام نمایشی', done: true }]}
      />,
    )

    const panel = await screen.findByText('سارا احمدی')
    expect(panel).toBeVisible()
    expect(screen.getByText('تأییدشده')).toBeVisible()
    expect(screen.getByLabelText('نام نمایشی')).toHaveValue('سارا احمدی')
    expect(screen.queryByLabelText('شناسه ملی')).not.toBeInTheDocument()
    expect(within(panel.closest('section')!).getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '60',
    )
  })
})
