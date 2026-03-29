import { useContext } from 'react'
import { FlagifyContext } from './context'

export function useFlagifyClient() {
  const ctx = useContext(FlagifyContext)

  if (!ctx.client) {
    throw new Error(
      'useFlagifyClient must be used within a <FlagifyProvider>',
    )
  }

  return ctx.client
}
