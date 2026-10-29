import { useHealth } from './health'

export function StatusChip() {
  const { isPending, isError, data } = useHealth()

  const state = isPending ? 'pending' : isError ? 'error' : 'ok'
  const label = {
    pending: 'در حال بررسی سرور',
    ok: 'سرور متصل است',
    error: 'سرور در دسترس نیست',
  }[state]

  return (
    <p
      className={`status status--${state}`}
      role="status"
      title={data ? `نسخه‌ی سرور ${data.version}` : undefined}
    >
      <span className="status__dot" aria-hidden="true" />
      {label}
    </p>
  )
}
