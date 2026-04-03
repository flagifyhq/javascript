import { createContext } from 'react'
import type { Flagify } from '@flagify/node'

export interface FlagifyContextValue {
  client: Flagify | null
  isReady: boolean
  /** Increments on every SSE flag_change event to trigger re-renders */
  version: number
}

/** Sentinel value — when context equals this, no provider exists */
const NO_PROVIDER: FlagifyContextValue = {
  client: null,
  isReady: false,
  version: -1,
}

export const FlagifyContext = createContext<FlagifyContextValue>(NO_PROVIDER)

export { NO_PROVIDER }
