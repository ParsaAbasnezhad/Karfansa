import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from '@/features/home/icons'
import { manualInstallMethod } from './installationInstructions'
import { PwaContext, type InstallPromptEvent } from './pwa-context'
import './pwa.css'

const InstallDialog = lazy(() => import('./InstallDialog'))

function isStandalone() {
  const iosNavigator = navigator as Navigator & { standalone?: boolean }
  const displayMode =
    typeof window.matchMedia === 'function' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches)
  return displayMode || iosNavigator.standalone === true
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const [installed, setInstalled] = useState(isStandalone)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<InstallPromptEvent | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const appContentRef = useRef<HTMLDivElement>(null)
  const offlineActionRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const media =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(display-mode: standalone)')
        : null
    const updateDisplayMode = () => setInstalled(isStandalone())
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as InstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
      setDialogOpen(false)
    }
    const onOnline = () => setOnline(true)
    const onOffline = () => {
      setDialogOpen(false)
      setOnline(false)
    }

    if (media?.addEventListener) media.addEventListener('change', updateDisplayMode)
    else media?.addListener(updateDisplayMode)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      if (media?.removeEventListener) media.removeEventListener('change', updateDisplayMode)
      else media?.removeListener(updateDisplayMode)
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    const appContent = appContentRef.current
    if (!appContent) return
    if (!online) {
      const activeElement = document.activeElement
      previousFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null
      appContent.inert = true
      offlineActionRef.current?.focus({ preventScroll: true })
      return () => {
        appContent.inert = false
        if (previousFocusRef.current?.isConnected) {
          previousFocusRef.current.focus({ preventScroll: true })
        }
      }
    }
    appContent.inert = false
  }, [online])

  const requestInstall = useCallback(
    async (trigger: HTMLButtonElement) => {
      triggerRef.current = trigger
      if (isStandalone()) {
        setInstalled(true)
        return
      }
      if (!deferredPrompt) {
        setDialogOpen(true)
        return
      }

      const prompt = deferredPrompt
      setDeferredPrompt(null)
      try {
        await prompt.prompt()
        await prompt.userChoice
      } catch (error) {
        console.error('The browser installation prompt could not be opened.', error)
        setDialogOpen(true)
      }
    },
    [deferredPrompt],
  )

  const closeDialog = useCallback(() => {
    setDialogOpen(false)
    window.setTimeout(() => {
      if (triggerRef.current?.isConnected) triggerRef.current.focus({ preventScroll: true })
    }, 0)
  }, [])

  return (
    <PwaContext.Provider
      value={{
        installed,
        installMethod: deferredPrompt ? 'native' : manualInstallMethod(),
        requestInstall,
      }}
    >
      <div ref={appContentRef} className="pwa-app-content">
        {children}
      </div>
      {dialogOpen && (
        <Suspense fallback={null}>
          <InstallDialog onClose={closeDialog} />
        </Suspense>
      )}
      {!online && (
        <section
          className="pwa-offline-overlay"
          dir="rtl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-offline-title"
        >
          <div className="pwa-offline-card">
            <img src="/icons/icon-192.png" width="72" height="72" alt="" />
            <span className="pwa-offline-mark" aria-hidden="true">
              <Icon name="alert" />
            </span>
            <h1 id="pwa-offline-title">اتصال اینترنت برقرار نیست</h1>
            <p>برای دسترسی به اطلاعات به‌روز کارفنسا، اتصال اینترنت خود را بررسی کنید.</p>
            <button
              ref={offlineActionRef}
              type="button"
              className="pwa-primary-action"
              onClick={() => window.location.reload()}
            >
              تلاش مجدد
            </button>
          </div>
        </section>
      )}
    </PwaContext.Provider>
  )
}
