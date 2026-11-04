import { useEffect, useState } from 'react'
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

/** Smooth-scrolls to the newsletter band in the footer and focuses its email field. */
export function scrollToNewsletter() {
  document.getElementById('nl')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  setTimeout(() => document.getElementById('email')?.focus({ preventScroll: true }), 600)
}
