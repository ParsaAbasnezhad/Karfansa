import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { resourceApi } from '@/api/resources'
import type { ResourceField } from '@/api/types'
import { Input } from '@/components/ui'

export type FieldValue = string | number | boolean | null | Array<string | number>

export function RelationControl({ field, value, onChange }: { field: ResourceField; value: FieldValue; onChange: (value: FieldValue) => void }) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 250)
    return () => window.clearTimeout(timer)
  }, [query])
  const choices = useQuery({
    queryKey: ['relationship-options', field.related_resource, debouncedQuery],
    queryFn: ({ signal }) => resourceApi.list(field.related_resource!, { q: debouncedQuery, page: 1, page_size: 100 }, signal),
    enabled: !!field.related_resource,
  })
  if (!field.related_resource) return <p className="field-error">برای این رابطه هنوز فهرست مجاز پیکربندی نشده است.</p>
  const label = (record: Record<string, unknown>) => {
    for (const key of ['name', 'name_fa', 'title', 'email', 'symbol', 'full_name', 'display_name']) {
      if (typeof record[key] === 'string' && record[key]) return String(record[key])
    }
    return `#${record.id}`
  }
  const selected = Array.isArray(value) ? value.map(String) : value == null || value === '' ? [] : [String(value)]
  return <div className="relationship-control"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجوی گزینه…" aria-label={`جستجوی ${field.label}`} /><select className="input" multiple={field.multiple} value={field.multiple ? selected : selected[0] ?? ''} onChange={(event) => onChange(field.multiple ? Array.from(event.target.selectedOptions, (option) => option.value) : event.target.value)} disabled={choices.isPending || choices.isError}>{!field.multiple && <option value="">انتخاب کنید</option>}{choices.data?.items.map((record) => <option key={String(record.id)} value={String(record.id)}>{label(record)}</option>)}</select>{field.multiple && <small className="muted">برای انتخاب چند مورد از Ctrl یا Command استفاده کنید.</small>}{choices.isError && <small className="field-error">گزینه‌های رابطه بارگیری نشدند.</small>}</div>
}

export function FieldControl({ field, value, onChange, id }: { field: ResourceField; value: FieldValue; onChange: (value: FieldValue) => void; id?: string }) {
  if (field.type === 'boolean') return <label className="switch-row"><input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} /><span>{field.help_text ?? field.label}</span></label>
  if (field.choices?.length) return <select id={id} className="input" value={value == null ? '' : String(value)} onChange={(event) => onChange(event.target.value)}><option value="">انتخاب کنید</option>{field.choices.map((choice) => <option key={String(choice.value)} value={String(choice.value)}>{choice.label}</option>)}</select>
  if (field.type === 'textarea') return <textarea id={id} className="input textarea" value={value == null ? '' : String(value)} onChange={(event) => onChange(event.target.value)} maxLength={field.max_length} rows={5} />
  if (field.type === 'relation') return <RelationControl field={field} value={value} onChange={onChange} />
  return <Input id={id} type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'datetime' ? 'datetime-local' : field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'} value={value == null ? '' : String(value)} onChange={(event) => onChange(field.type === 'number' ? event.target.value === '' ? null : Number(event.target.value) : event.target.value)} maxLength={field.max_length} dir={field.type === 'email' || field.type === 'url' ? 'ltr' : undefined} />
}
