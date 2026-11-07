import { screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { SiteHeader } from './SiteHeader'

describe('SiteHeader authentication actions', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('keeps login and registration available when signed out', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    renderWithProviders(<SiteHeader />)

    expect(await screen.findAllByText('ورود / ثبت‌نام')).toHaveLength(2)
    expect(screen.getByText('ثبت‌نام')).toBeInTheDocument()
  })

  it('hides login and registration actions for a signed-in user', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input)
        const data = url.endsWith('/v1/auth/me')
          ? {
              email: 'user@example.com',
              phone: '+989121234567',
              first_name: 'سارا',
              last_name: 'احمدی',
              date_joined: '2026-01-01T00:00:00Z',
            }
          : { results: [] }
        return { ok: true, status: 200, json: async () => data }
      }),
    )
    renderWithProviders(<SiteHeader />)

    await waitFor(() => {
      expect(screen.queryByText('ورود / ثبت‌نام')).not.toBeInTheDocument()
      expect(screen.queryByText('ثبت‌نام')).not.toBeInTheDocument()
    })
  })
})
