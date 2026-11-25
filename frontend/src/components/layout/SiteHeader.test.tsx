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

  it('keeps header navigation out of the footer and links only to existing help pages', async () => {
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
    const footer = within(screen.getByRole('contentinfo'))
    const bottomBar = footer.getByRole('navigation', { name: 'شبکه‌های اجتماعی کارفنسا' })
    expect(bottomBar.parentElement).toHaveClass('footer-bottom-inner')
    for (const headerItem of [
      'اخبار',
      'شرکت‌ها',
      'بازارها',
      'صفحه اصلی',
      'تماس با ما',
      'ورود / ثبت‌نام',
    ]) {
      expect(footer.queryByRole('link', { name: headerItem })).not.toBeInTheDocument()
    }
    for (const social of [
      { name: 'تلگرام', href: 'https://t.me/karfansa' },
      { name: 'اینستاگرام', href: 'https://instagram.com/karfansa' },
      { name: 'لینکدین', href: 'https://linkedin.com/company/karfansa' },
      { name: 'ایکس', href: 'https://x.com/karfansa' },
    ]) {
      const link = within(bottomBar).getByRole('link', { name: social.name })
      expect(link).toHaveAttribute('href', social.href)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
    expect(footer.queryByRole('link', { name: 'واتساپ' })).not.toBeInTheDocument()
    expect(footer.getByLabelText('جایگاه نماد اعتماد الکترونیکی')).toBeInTheDocument()
    expect(footer.getByLabelText('جایگاه نماد ساماندهی')).toBeInTheDocument()
    expect(footer.queryByRole('link', { name: 'مرکز پشتیبانی' })).toHaveAttribute(
      'href',
      '/account/support/',
    )
    expect(footer.getByRole('link', { name: 'ثبت درخواست پشتیبانی' })).toHaveAttribute(
      'href',
      '/account/support/?new=1',
    )
    expect(footer.getByRole('link', { name: 'پرسش‌های متداول' })).toHaveAttribute(
      'href',
      '/contact/#contact-faq-title',
    )
    for (const link of [desktop, mobile]) {
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
