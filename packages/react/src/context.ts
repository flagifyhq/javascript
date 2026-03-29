import { createContext } from 'react'
import type { Flagify } from '@flagify/node'

export interface FlagifyContextValue {
  client: Flagify | null
  isReady: boolean
}

export const FlagifyContext = createContext<FlagifyContextValue>({
  client: null,
  isReady: false,
})
