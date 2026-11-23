import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { AnalysisArchivePage, AnalysisDetailPage } from './AnalysisPages'

describe('analysis pages', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('filters archive reports through search', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    renderWithProviders(<AnalysisArchivePage />)

    const search = await screen.findByRole('searchbox', {
      name: 'جست‌وجو در تحلیل‌ها و گزارش‌ها',
    })
    await userEvent.type(search, 'بورس')
    await userEvent.click(screen.getByRole('button', { name: 'جست‌وجو' }))

    expect(await screen.findByRole('heading', { name: /رشد بورس/ })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /زنجیره ارزش فولاد/ })).not.toBeInTheDocument()
  })

  it('loads a report detail from the analysis API', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    renderWithProviders(
      <Routes>
        <Route path="/analysis/:slug" element={<AnalysisDetailPage />} />
      </Routes>,
      { route: '/analysis/analysis-1' },
    )

    expect(
      await screen.findByRole('heading', {
        name: /چشم‌انداز اقتصاد ایران در نیمه دوم/,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('برای این گزارش فایل جداگانه‌ای ثبت نشده است.')).toBeInTheDocument()
  })
})
