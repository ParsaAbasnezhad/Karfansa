// Persian (Jalali) number and date helpers. Dates are always shown in Tehran time.
const TZ = 'Asia/Tehran'

const numberFormat = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 })
export const formatNumber = (n: number): string => numberFormat.format(n)

export const formatChange = (change: number): string => {
  const sign = change > 0 ? '+' : change < 0 ? '−' : ''
  return `${sign}${numberFormat.format(Math.abs(change))}٪`
}

const dateParts = (() => {
  const f = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return (d: Date): Record<string, string> =>
    Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]))
})()

const clockFormat = new Intl.DateTimeFormat('fa-IR', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: TZ,
})
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TZ })

type DateInput = string | number | Date
const toDate = (v: DateInput): Date => (v instanceof Date ? v : new Date(v))

/** "سه‌شنبه ۵ آبان ۱۴۰۵" */
export const formatLongDate = (v: DateInput): string => {
  const p = dateParts(toDate(v))
  return `${p.weekday} ${p.day} ${p.month} ${p.year}`
}

/** "۵ آبان ۱۴۰۵" */
export const formatShortDate = (v: DateInput): string => {
  const p = dateParts(toDate(v))
  return `${p.day} ${p.month} ${p.year}`
}

export const jalaliYear = (v: DateInput): string => dateParts(toDate(v)).year ?? ''

/** "۱۴:۳۰" */
export const formatClock = (v: DateInput): string => clockFormat.format(toDate(v))

export const isSameDay = (a: DateInput, b: DateInput): boolean =>
  dayKey.format(toDate(a)) === dayKey.format(toDate(b))

/** "۷ ساعت پیش", "۲ روز پیش". */
export function timeAgo(v: DateInput, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - toDate(v).getTime()) / 60000)
  if (minutes < 1) return 'لحظاتی پیش'
  if (minutes < 60) return `${formatNumber(minutes)} دقیقه پیش`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${formatNumber(hours)} ساعت پیش`
  return `${formatNumber(Math.floor(hours / 24))} روز پیش`
}

/** "امروز، ۱۴:۳۰" for today, otherwise the Jalali date. */
export const whenLabel = (v: DateInput): string =>
  isSameDay(v, new Date()) ? `امروز، ${formatClock(v)}` : formatShortDate(v)
