import { useContext } from 'react'
import { FlagifyContext } from './context'
import { useFlagifyClient } from './useFlagifyClient'

export function useFlag(flagKey: string): boolean | undefined {
  const { version, isReady } = useContext(FlagifyContext)
  const client = useFlagifyClient()
  void version
  if (!isReady || !client) return undefined
  return client.isEnabled(flagKey)
}
