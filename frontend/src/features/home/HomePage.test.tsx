import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockHealth, renderApp } from '@/test/render'

beforeEach(() => {
  mockHealth(true)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('HomePage', () => {
  it('has one main heading and a labelled search field', () => {
    renderApp()

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('تأمین‌کننده‌ی هر محصول')
    expect(screen.getByRole('searchbox', { name: 'نام محصول' })).toBeInTheDocument()
  })

  it('clearly labels the result preview as sample data', () => {
    renderApp()

    expect(screen.getByText(/داده‌ی واقعی نیست/)).toBeInTheDocument()
    expect(screen.getByText('یافته‌شده از وب و تأییدنشده')).toBeInTheDocument()
  })

  it('keeps transport companies separate from companies', () => {
    renderApp()

    expect(screen.getByRole('heading', { name: 'شرکت‌ها' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'شرکت‌های حمل‌ونقل' })).toBeInTheDocument()
  })

  it('submits a query to the search page and encodes it', async () => {
    const user = userEvent.setup()
    const { router } = renderApp()

    await user.type(screen.getByRole('searchbox', { name: 'نام محصول' }), '  زعفران ')
    await user.click(screen.getByRole('button', { name: 'جست‌وجو' }))

    expect(router.state.location.pathname).toBe('/search')
    expect(router.state.location.search).toBe(`?q=${encodeURIComponent('زعفران')}`)
    expect(await screen.findByText(/جست‌وجوی «زعفران» هنوز فعال نیست/)).toBeInTheDocument()
  })

  it('does not navigate when the query is only whitespace', async () => {
    const user = userEvent.setup()
    const { router } = renderApp()

    await user.type(screen.getByRole('searchbox', { name: 'نام محصول' }), '   ')
    await user.click(screen.getByRole('button', { name: 'جست‌وجو' }))

    expect(router.state.location.pathname).toBe('/')
  })

  it('shows a not-found page for unknown routes', () => {
    renderApp('/does-not-exist')

    expect(screen.getByRole('heading', { name: 'صفحه پیدا نشد' })).toBeInTheDocument()
  })
})
