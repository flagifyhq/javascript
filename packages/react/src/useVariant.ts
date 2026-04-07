import { useContext } from 'react'
import { FlagifyContext } from './context'
import { useFlagifyClient } from './useFlagifyClient'

export function useVariant(flagKey: string, fallback: string): string | undefined {
  const { version, isReady } = useContext(FlagifyContext)
  const client = useFlagifyClient()
  void version
  if (!isReady || !client) return undefined
  return client.getVariant(flagKey, fallback)
}
