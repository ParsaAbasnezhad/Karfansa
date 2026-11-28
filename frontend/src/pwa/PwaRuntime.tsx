import { useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { PwaUpdateNotice } from './PwaUpdateNotice'

export function PwaRuntime() {
  const [updateReady, setUpdateReady] = useState(false)
  const applyUpdateRef = useRef<(() => Promise<void>) | null>(null)

  useEffect(() => {
    if (!import.meta.env.PROD) return
    let disposed = false
    let stopUpdateChecks = () => {}
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh: () => {
        if (!disposed) setUpdateReady(true)
      },
      onRegisteredSW: (_swUrl, registration) => {
        if (disposed || !registration) return
        const checkForUpdate = () => {
          if (navigator.onLine && document.visibilityState === 'visible') {
            void registration.update().catch((error) => {
              console.error('The Karfansa application update check failed.', error)
            })
          }
        }
        const timer = window.setInterval(checkForUpdate, 60 * 60 * 1000)
        window.addEventListener('online', checkForUpdate)
        document.addEventListener('visibilitychange', checkForUpdate)
        stopUpdateChecks = () => {
          window.clearInterval(timer)
          window.removeEventListener('online', checkForUpdate)
          document.removeEventListener('visibilitychange', checkForUpdate)
        }
      },
    })
    applyUpdateRef.current = () => updateSW(true)
    return () => {
      disposed = true
      stopUpdateChecks()
      applyUpdateRef.current = null
    }
  }, [])

  if (!updateReady) return null
  return (
    <PwaUpdateNotice
      onUpdate={() => {
        if (!applyUpdateRef.current) throw new Error('The service worker update is not ready.')
        return applyUpdateRef.current()
      }}
    />
  )
}
