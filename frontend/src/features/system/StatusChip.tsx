import { useHealth, type HealthState } from './health'

const LABELS: Record<HealthState, string> = {
  checking: 'در حال بررسی سرویس',
  ok: 'سرویس برقرار است',
  degraded: 'سرویس با اختلال',
  offline: 'سرویس در دسترس نیست',
}

/** Small status dot with a label, shown in the footer. */
export function StatusChip() {
  const { state } = useHealth()
  return (
    <span className={`status-chip is-${state}`} role="status">
      <i aria-hidden="true" />
      {LABELS[state]}
    </span>
  )
}
