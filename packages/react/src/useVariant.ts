import { useContext } from 'react'
import { FlagifyContext } from './context'
import { useFlagifyClient } from './useFlagifyClient'

export function useVariant(flagKey: string, fallback: string): string {
  const { version } = useContext(FlagifyContext)
  const client = useFlagifyClient()
  void version
  return client.getVariant(flagKey, fallback)
}
