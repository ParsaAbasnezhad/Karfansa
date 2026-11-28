import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, type ReactNode } from 'react'
import { authApi } from '@/api/auth'
import { ApiError } from '@/api/client'
import type { AdminUser } from '@/api/types'
import { Loading } from '@/components/ui'

type AuthContextType = { user: AdminUser | null; refresh: () => Promise<void>; signOut: () => Promise<void> }
const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['admin-me'], queryFn: ({ signal }) => authApi.me(signal), retry: false, refetchOnWindowFocus: true, staleTime: 0 })
  if (query.isPending) return <main className="boot-screen"><Loading label="در حال بررسی دسترسی…" /></main>
  if (query.isError && !(query.error instanceof ApiError && query.error.status === 401)) {
    return <main className="boot-screen"><div className="card boot-error"><h1>اتصال به مرکز کنترل برقرار نشد</h1><p>{query.error.message}</p><button className="button button-primary" onClick={() => void query.refetch()}>تلاش مجدد</button></div></main>
  }
  const value: AuthContextType = {
    user: query.data ?? null,
    refresh: async () => { await queryClient.invalidateQueries({ queryKey: ['admin-me'] }) },
    signOut: async () => { try { await authApi.logout() } finally { queryClient.clear(); window.location.assign('/login') } },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider is required')
  return value
}
