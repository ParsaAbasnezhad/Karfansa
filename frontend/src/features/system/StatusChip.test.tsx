import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { StatusChip } from './StatusChip'

describe('StatusChip', () => {
  it('shows ok when the API answers ok', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    renderWithProviders(<StatusChip />)
    expect(await screen.findByText('سرویس برقرار است')).toBeInTheDocument()
  })

  it('shows offline when the request fails', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    renderWithProviders(<StatusChip />)
    expect(await screen.findByText('سرویس در دسترس نیست')).toBeInTheDocument()
  })
})
