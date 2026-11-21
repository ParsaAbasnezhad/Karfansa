import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'

describe('SiteHeader authentication actions', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('keeps login and registration available when signed out', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    renderWithProviders(<SiteHeader />)

    expect(await screen.findAllByText('ورود / ثبت‌نام')).toHaveLength(2)
    expect(screen.getByText('ثبت‌نام')).toBeInTheDocument()
  })

  it('opens the independent news site from desktop, mobile and footer navigation', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    renderWithProviders(
      <>
        <SiteHeader />
        <SiteFooter />
      </>,
    )

    const desktop = within(screen.getByRole('navigation', { name: 'منوی اصلی' })).getByRole(
      'link',
      {
        name: 'اخبار',
      },
    )
    await userEvent.click(screen.getByRole('button', { name: 'منو' }))
    const mobile = within(screen.getByRole('navigation', { name: 'بخش‌ها' })).getByRole('link', {
      name: 'اخبار',
    })
    const footer = within(screen.getByRole('contentinfo')).getByRole('link', { name: 'اخبار' })
    for (const link of [desktop, mobile, footer]) {
      expect(link).toHaveAttribute('href', 'https://karfansa.news.ir')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
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
