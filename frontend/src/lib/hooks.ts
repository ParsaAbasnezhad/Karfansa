import { useCallback, useEffect, useState } from 'react'
import { formatClock, formatLongDate, jalaliYear } from './format'

/** Today's Jalali date, the clock and the Jalali year, in Tehran time. Updates every 20 seconds. */
export function useTehranClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 20_000)
    return () => clearInterval(id)
  }, [])
  return { today: formatLongDate(now), time: formatClock(now), year: jalaliYear(now) }
}

const THEME_KEY = 'kf-theme'

/** Returns a function that flips light/dark. With no saved choice the page follows the system setting. */
export function useThemeToggle() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY)
      if (saved) document.documentElement.setAttribute('data-theme', saved)
    } catch {
      // storage blocked
    }
  }, [])

  return useCallback(() => {
    const root = document.documentElement
    const current = root.getAttribute('data-theme')
    const dark = current ? current === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
    const next = dark ? 'light' : 'dark'
    root.setAttribute('data-theme', next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      // storage blocked
    }
  }, [])
}

/** Smooth-scrolls to the newsletter band in the footer and focuses its email field. */
export function scrollToNewsletter() {
  document.getElementById('nl')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  setTimeout(() => document.getElementById('email')?.focus({ preventScroll: true }), 600)
}
