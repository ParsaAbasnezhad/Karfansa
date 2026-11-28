import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { isAppNavigation, isSensitiveRequest, sensitiveRequestMethods } from './cachePolicy'
import { installationInstructions } from './installationInstructions'
import { PwaInstallButton, PwaPromoCard } from './PwaInstallButton'
import { PwaUpdateNotice } from './PwaUpdateNotice'

function installButton() {
  return renderWithProviders(<PwaInstallButton />)
}

describe('PWA installation', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (navigator as Navigator & { standalone?: boolean }).standalone
  })

  it('does not open installation instructions until the user requests installation', () => {
    installButton()
    expect(screen.getByRole('button', { name: 'راهنمای نصب' })).toBeVisible()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('invokes the native prompt only after a click', async () => {
    const prompt = vi.fn().mockResolvedValue(undefined)
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' }),
    })
    installButton()
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(prompt).not.toHaveBeenCalled()

    await userEvent.click(await screen.findByRole('button', { name: 'نصب اپلیکیشن' }))
    expect(prompt).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('hides installation actions after the appinstalled event', async () => {
    renderWithProviders(
      <>
        <PwaInstallButton />
        <PwaPromoCard placement="home" />
      </>,
    )
    window.dispatchEvent(new Event('appinstalled'))
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'راهنمای نصب' })).not.toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'اپلیکیشن کارفنسا' })).not.toBeInTheDocument()
    })
  })

  it('detects an already standalone app and hides installation actions', () => {
    const originalMatchMedia = window.matchMedia
    window.matchMedia = (query: string) =>
      ({
        ...originalMatchMedia(query),
        matches: query === '(display-mode: standalone)',
      }) as MediaQueryList
    installButton()
    expect(screen.queryByRole('button', { name: 'راهنمای نصب' })).not.toBeInTheDocument()
    window.matchMedia = originalMatchMedia
  })

  it('recognizes iOS standalone mode', () => {
    ;(navigator as Navigator & { standalone?: boolean }).standalone = true
    renderWithProviders(<PwaPromoCard placement="home" />)
    expect(screen.queryByRole('region', { name: 'اپلیکیشن کارفنسا' })).not.toBeInTheDocument()
  })

  it('shows the accurate iOS Safari installation steps', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'userAgent')
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    })
    installButton()
    await userEvent.click(screen.getByRole('button', { name: 'نصب اپلیکیشن' }))
    expect(
      await screen.findByRole('dialog', { name: 'نصب کارفنسا در آیفون و آیپد' }),
    ).toBeInTheDocument()
    expect(screen.getByText('گزینه اشتراک‌گذاری را انتخاب کنید.')).toBeInTheDocument()
    expect(screen.getByText('گزینه Add to Home Screen را بزنید.')).toBeInTheDocument()
    expect(screen.getByText('گزینه Add را انتخاب کنید.')).toBeInTheDocument()
    if (descriptor) Object.defineProperty(navigator, 'userAgent', descriptor)
    else Reflect.deleteProperty(navigator, 'userAgent')
  })

  it('does not claim that installation is supported in an unsupported browser', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'userAgent')
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/130.0',
    })
    renderWithProviders(<PwaPromoCard />)
    const card = screen.getByRole('region', { name: 'اپلیکیشن کارفنسا' })
    expect(within(card).getByText('نصب مستقیم در این مرورگر در دسترس نیست')).toBeVisible()
    await userEvent.click(within(card).getByRole('button', { name: 'راهنمای نصب' }))
    expect(await screen.findByText(/نصب مستقیم در این لحظه.*در دسترس نیست/)).toBeInTheDocument()
    if (descriptor) Object.defineProperty(navigator, 'userAgent', descriptor)
    else Reflect.deleteProperty(navigator, 'userAgent')
  })

  it('closes the installation guide on the native cancel event and restores focus', async () => {
    installButton()
    const button = screen.getByRole('button', { name: 'راهنمای نصب' })
    await userEvent.click(button)
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toContainElement(screen.getByRole('button', { name: 'بستن راهنمای نصب' }))
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(button).toHaveFocus())
  })

  it('covers business screens while offline and restores them on reconnect', async () => {
    installButton()
    fireEvent(window, new Event('offline'))
    expect(await screen.findByRole('heading', { name: 'اتصال اینترنت برقرار نیست' })).toBeVisible()
    fireEvent(window, new Event('online'))
    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'اتصال اینترنت برقرار نیست' }),
      ).not.toBeInTheDocument()
    })
  })

  it('routes every sensitive method to the network and excludes sensitive navigations', () => {
    expect(sensitiveRequestMethods).toEqual(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
    const navigation = { mode: 'navigate' } as Request
    for (const pathname of [
      '/api',
      '/api/v1/auth/me',
      '/api/v1/management/resources/',
      '/admin/',
      '/media/private/report.pdf',
      '/private_media/verification.pdf',
    ]) {
      const url = new URL(pathname, 'https://karfansa.test')
      expect(isSensitiveRequest({ url })).toBe(true)
      expect(isAppNavigation({ request: navigation, url })).toBe(false)
    }
    for (const pathname of ['/apix/file', '/static/app.js', '/img/hero.jpg']) {
      const url = new URL(pathname, 'https://karfansa.test')
      expect(isSensitiveRequest({ url })).toBe(false)
      expect(isAppNavigation({ request: navigation, url })).toBe(true)
    }
  })

  it('provides browser-specific installation instructions without false claims', () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'userAgent')
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Linux; Android 13) Chrome/120.0.0.0 Mobile Safari/537.36',
    })
    expect(installationInstructions().description).toContain('منوی مرورگر')
    if (descriptor) Object.defineProperty(navigator, 'userAgent', descriptor)
    else Reflect.deleteProperty(navigator, 'userAgent')
  })
})

describe('PWA updates', () => {
  it('waits for an explicit update action', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(<PwaUpdateNotice onUpdate={onUpdate} />)
    expect(onUpdate).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'به‌روزرسانی' }))
    expect(onUpdate).toHaveBeenCalledOnce()
  })
})
