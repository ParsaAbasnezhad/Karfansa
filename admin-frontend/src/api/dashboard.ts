import { api, params } from './client'
import type { DashboardData, HealthData } from './types'

export const dashboardApi = {
  get: (days: number, signal?: AbortSignal) => api<DashboardData>(`/dashboard/${params({ days })}`, { signal }),
  health: (signal?: AbortSignal) => api<HealthData>('/health/', { signal }),
}
