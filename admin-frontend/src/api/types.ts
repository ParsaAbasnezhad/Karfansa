export interface AdminUser {
  id: number
  name?: string
  full_name?: string
  email?: string
  mobile?: string
  is_super_admin?: boolean
  is_superuser?: boolean
  mfa_required?: boolean
  permissions?: string[]
  roles?: string[]
}

export interface ResourceField {
  name: string
  label: string
  type?: 'text' | 'textarea' | 'number' | 'boolean' | 'date' | 'datetime' | 'select' | 'email' | 'url' | 'relationship' | 'relation' | 'file' | 'json' | 'readonly'
  required?: boolean
  read_only?: boolean
  choices?: Array<{ value: string | number | boolean; label: string }>
  max_length?: number
  help_text?: string
  related_resource?: string | null
  multiple?: boolean
}

export interface InlineSpec {
  key: string
  title: string
  child_slug: string
  fk_name: string
  can_add?: boolean
  can_delete?: boolean
  can_update?: boolean
}

export interface ResourceDescriptor {
  slug: string
  title: string
  singular?: string
  group?: string
  icon?: string
  fields: ResourceField[]
  write_only_fields?: Array<{ name: string; label: string }>
  list_fields?: string[]
  search_fields?: string[]
  filter_fields?: string[]
  actions?: Array<{ key: string; label: string; tone?: 'danger' | 'normal' }>
  can_view?: boolean
  can_create?: boolean
  can_update?: boolean
  can_delete?: boolean
  can_export?: boolean
  permissions?: { view: boolean; create: boolean; update: boolean; delete: boolean; export: boolean }
  inlines?: InlineSpec[]
  uploadable_fields?: string[]
}

export type RecordValue = string | number | boolean | null | Record<string, unknown> | unknown[]
export type ResourceRecord = Record<string, RecordValue> & { id: string | number }

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface Metric { key: string; label: string; value: number | null; change?: number | null }
export interface ChartPoint { date?: string; label?: string; name?: string; value?: number; count?: number; [key: string]: string | number | undefined }
export interface DashboardData {
  metrics: Metric[]
  charts: Record<string, ChartPoint[]>
  recent_activities?: Array<{ id: string | number; action: string; actor: string; target?: string; created_at: string }>
  from_date?: string
  to_date?: string
}

export interface HealthComponent { status: 'ok' | 'error' | 'unknown' | 'stale'; detail?: string | null; value?: string | number | null }
export interface HealthData {
  database?: HealthComponent
  redis?: HealthComponent
  celery_workers?: HealthComponent
  celery_beat?: HealthComponent
  checked_at?: string
  database_bytes?: number | null
  storage_used_bytes?: number | null
  storage_total_bytes?: number | null
  failed_tasks_24h?: number | null
  completed_tasks_24h?: number | null
  api_p95_ms?: number | null
}
