import { createContext } from 'react'
import type { Flagify } from '@flagify/node'

export interface FlagifyContextValue {
  client: Flagify | null
  isReady: boolean
  /** Increments on every SSE flag_change event to trigger re-renders */
  version: number
}

export const FlagifyContext = createContext<FlagifyContextValue>({
  client: null,
  isReady: false,
  version: 0,
})
