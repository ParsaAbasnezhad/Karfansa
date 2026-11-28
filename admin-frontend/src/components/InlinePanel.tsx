import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { resourceApi } from '@/api/resources'
import type { InlineSpec, ResourceDescriptor, ResourceRecord } from '@/api/types'
import { Button, Card, Loading } from '@/components/ui'
import { useToast } from '@/components/ToastProvider'
import { FieldControl, type FieldValue } from '@/components/FieldControl'

interface Row {
  id: string | null
  values: Record<string, FieldValue>
  removed: boolean
  original: Record<string, FieldValue> | null
}

function toValue(value: unknown): FieldValue {
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return (value as FieldValue) ?? null
  if (Array.isArray(value) && value.every((item) => typeof item === 'string' || typeof item === 'number')) return value as Array<string | number>
  return null
}

export function InlinePanel({ slug, id, inline, childDescriptor }: { slug: string; id: string; inline: InlineSpec; childDescriptor?: ResourceDescriptor }) {
  const queryClient = useQueryClient()
  const notify = useToast()
  const queryKey = ['inline', slug, id, inline.key]
  const query = useQuery({ queryKey, queryFn: ({ signal }) => resourceApi.listInline(slug, id, inline.key, signal), enabled: !!childDescriptor })
  const [rows, setRows] = useState<Row[]>([])
  const [dirty, setDirty] = useState(false)

  const editableFields = useMemo(
    () => (childDescriptor?.fields ?? []).filter((field) => !field.read_only && field.name !== inline.fk_name && field.type !== 'file'),
    [childDescriptor, inline.fk_name],
  )

  useEffect(() => {
    const loaded: Row[] = (query.data ?? []).map((record: ResourceRecord) => {
      const values: Record<string, FieldValue> = {}
      for (const field of editableFields) values[field.name] = toValue(record[field.name])
      return { id: String(record.id), values, removed: false, original: { ...values } }
    })
    setRows(loaded)
    setDirty(false)
  }, [query.data, editableFields])

  const save = useMutation({
    mutationFn: async () => {
      const creates: Array<Record<string, unknown>> = []
      const updates: Array<Record<string, unknown>> = []
      const deletes: string[] = []
      for (const row of rows) {
        if (row.removed) { if (row.id) deletes.push(row.id); continue }
        if (row.id === null) {
          if (Object.values(row.values).some((value) => value !== '' && value !== null && !(Array.isArray(value) && value.length === 0))) creates.push({ ...row.values })
        } else if (JSON.stringify(row.values) !== JSON.stringify(row.original)) {
          updates.push({ id: row.id, ...row.values })
        }
      }
      return resourceApi.syncInline(slug, id, inline.key, { creates, updates, deletes })
    },
    onSuccess: () => {
      notify('ردیف‌های این بخش ذخیره شدند.')
      void queryClient.invalidateQueries({ queryKey })
      void queryClient.invalidateQueries({ queryKey: ['resource-detail', slug, id] })
      void queryClient.invalidateQueries({ queryKey: ['resource', slug] })
    },
    onError: (error) => notify(error instanceof Error ? error.message : 'ذخیره این بخش انجام نشد.', 'error'),
  })

  const updateRow = (index: number, name: string, value: FieldValue) => {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, values: { ...row.values, [name]: value } } : row)))
    setDirty(true)
  }

  const activeRows = rows.filter((row) => !row.removed)

  return <Card className="detail-card inline-panel">
    <div className="section-head"><h2>{inline.title}</h2>{inline.can_add && <Button variant="secondary" type="button" onClick={() => { const empty: Record<string, FieldValue> = {}; for (const field of editableFields) empty[field.name] = field.multiple ? [] : null; setRows((current) => [...current, { id: null, values: empty, removed: false, original: null }]); setDirty(true) }}><Plus size={16} /> افزودن ردیف</Button>}</div>
    {query.isPending ? <Loading /> : activeRows.length === 0 && !dirty ? <p className="muted">ردیفی ثبت نشده است.</p> : null}
    <div className="inline-rows">
      {rows.map((row, index) => row.removed ? null : <div className="inline-row" key={row.id ?? `new-${index}`}>
        <div className="form-grid">{editableFields.map((field) => <div className="form-field" key={field.name}><label>{field.label}{field.required && <span className="required">*</span>}</label><FieldControl field={field} value={row.values[field.name] ?? null} onChange={(value) => updateRow(index, field.name, value)} /></div>)}</div>
        {(inline.can_delete || row.id === null) && <Button variant="danger" type="button" onClick={() => { if (row.id === null) setRows((current) => current.filter((_, rowIndex) => rowIndex !== index)); else setRows((current) => current.map((item, rowIndex) => (rowIndex === index ? { ...item, removed: true } : item))); setDirty(true) }}><Trash2 size={16} /> حذف ردیف</Button>}
      </div>)}
    </div>
    <div className="form-footer"><Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'در حال ذخیره…' : 'ذخیره این بخش'}</Button></div>
  </Card>
}
