import { apiPost } from '@/lib/api-client'

export const INTENT_GOALS = [
  {
    id: 'company_owner',
    title: 'صاحب شرکت هستم',
    description: 'حضور حرفه‌ای شرکت در بازار',
    icon: 'building',
  },
  {
    id: 'offering',
    title: 'محصول یا خدمات دارم',
    description: 'معرفی و عرضه به خریداران',
    icon: 'box',
  },
  {
    id: 'have_opportunity',
    title: 'فرصت تجاری دارم',
    description: 'پیدا کردن شریک مناسب',
    icon: 'bolt',
  },
  {
    id: 'seek_opportunity',
    title: 'دنبال فرصت تجاری هستم',
    description: 'کشف مسیرهای همکاری',
    icon: 'search',
  },
  {
    id: 'exploring',
    title: 'برای آشنایی و بررسی آمده‌ام',
    description: 'شناخت امکانات کارفنسا',
    icon: 'compass',
  },
] as const

export type IntentGoal = (typeof INTENT_GOALS)[number]['id']

export interface IntentRecord {
  has_intent: boolean
  goals: IntentGoal[]
  contact_phone: string
  contact_consent: boolean
  created_at: string | null
}

interface GuestIntent {
  token: string
  goals: IntentGoal[]
  saved: boolean
}

export const GUEST_INTENT_KEY = 'karfansa.intent.guest.v1'

export function readGuestIntent(): GuestIntent | null {
  try {
    const raw = localStorage.getItem(GUEST_INTENT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as GuestIntent
    if (typeof parsed.token !== 'string' || !Array.isArray(parsed.goals)) return null
    return parsed
  } catch {
    return null
  }
}

export function ensureGuestToken(): string {
  const previous = readGuestIntent()
  if (previous?.token) return previous.token
  const token = crypto.randomUUID()
  try {
    localStorage.setItem(GUEST_INTENT_KEY, JSON.stringify({ token, goals: [], saved: false }))
  } catch {
    // The request can still be submitted; persistence depends on browser storage.
  }
  return token
}

export function markGuestIntentSaved(token: string, goals: IntentGoal[]): void {
  try {
    localStorage.setItem(GUEST_INTENT_KEY, JSON.stringify({ token, goals, saved: true }))
  } catch {
    // Storage may be disabled by the browser.
  }
}

export function clearGuestIntent(): void {
  try {
    localStorage.removeItem(GUEST_INTENT_KEY)
  } catch {
    // No local state to clear when storage is unavailable.
  }
}

export async function claimStoredGuestIntent(): Promise<boolean> {
  const stored = readGuestIntent()
  if (!stored?.saved) return false
  const result = await apiPost<{ saved: boolean }>('/v1/intents/claim', { token: stored.token })
  if (result.saved) clearGuestIntent()
  return result.saved
}

export function normalizeIranianMobile(value: string): string | null {
  const digits = value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[\s\-()]/g, '')
  if (!digits) return ''
  const normalized = digits.startsWith('+98')
    ? `0${digits.slice(3)}`
    : digits.startsWith('0098')
      ? `0${digits.slice(4)}`
      : digits
  return /^09[0-9]{9}$/.test(normalized) ? normalized : null
}

export function toggleIntentGoal(current: IntentGoal[], goal: IntentGoal): IntentGoal[] {
  if (current.includes(goal)) return current.filter((item) => item !== goal)
  if (goal === 'exploring') return [goal]
  return [...current.filter((item) => item !== 'exploring'), goal]
}
