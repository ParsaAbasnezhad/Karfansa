import { ApiError } from '@/lib/api-client'
import type { ServiceCategory } from './types'

export const API = '/v1/services'

export function messageFrom(error: unknown) {
  return error instanceof ApiError ? error.message : 'ارتباط با سرویس برقرار نشد.'
}

export function flattenCategories(categories: ServiceCategory[]): ServiceCategory[] {
  return categories.flatMap((category) => [category, ...flattenCategories(category.children)])
}
