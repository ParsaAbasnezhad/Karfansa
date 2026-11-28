export const numberFormat = new Intl.NumberFormat('fa-IR')
export const dateFormat = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' })

export function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'بله' : 'خیر'
  if (typeof value === 'number') return numberFormat.format(value)
  if (Array.isArray(value)) return value.map(formatValue).join('، ')
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return formatValue(record.label ?? record.name ?? record.title ?? record.id ?? '—')
  }
  return String(value)
}

export function formatDate(value: string | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : dateFormat.format(date)
}
