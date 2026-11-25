import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { ManagementLayout } from './ManagementLayout'

describe('ManagementLayout', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('keeps the shared header mounted and marks the active section during navigation', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    renderWithProviders(
      <Routes>
        <Route element={<ManagementLayout />}>
          <Route path="/account" element={<h1>صفحه حساب</h1>} />
          <Route path="/business" element={<h1>صفحه کسب‌وکار</h1>} />
          <Route path="/account/inquiries" element={<h1>صفحه درخواست‌ها</h1>} />
        </Route>
      </Routes>,
      { route: '/account' },
    )

    const header = screen.getByRole('banner')
    const nav = screen.getByRole('navigation', { name: 'بخش‌های مدیریت' })
    expect(nav.querySelector('[aria-current="page"]')).toHaveAttribute('href', '/account')

    await userEvent.click(screen.getByRole('link', { name: 'مدیریت کسب‌وکار' }))
    expect(screen.getByRole('heading', { name: 'صفحه کسب‌وکار' })).toBeVisible()
    expect(screen.getByRole('banner')).toBe(header)
    expect(nav.querySelector('[aria-current="page"]')).toHaveAttribute('href', '/business')

    await userEvent.click(screen.getByRole('link', { name: 'مدیریت درخواست‌ها' }))
    expect(screen.getByRole('heading', { name: 'صفحه درخواست‌ها' })).toBeVisible()
    expect(screen.getByRole('banner')).toBe(header)
    expect(nav.querySelector('[aria-current="page"]')).toHaveAttribute('href', '/account/inquiries')
  })
})
