import { createContext, useContext } from 'react'

export type ShowToast = (message: string) => void

export const ToastContext = createContext<ShowToast>(() => {})

/** Show a short message at the bottom of the screen. */
export const useToast = (): ShowToast => useContext(ToastContext)
