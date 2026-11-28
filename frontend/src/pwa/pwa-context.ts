import { createContext, useContext } from 'react'
import type { ManualInstallMethod } from './installationInstructions'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

interface PwaContextValue {
  installed: boolean
  installMethod: 'native' | ManualInstallMethod
  requestInstall: (trigger: HTMLButtonElement) => Promise<void>
}

export const PwaContext = createContext<PwaContextValue | null>(null)

export function usePwa() {
  const value = useContext(PwaContext)
  if (!value) throw new Error('usePwa must be used within PwaProvider')
  return value
}

export type { InstallPromptEvent }
