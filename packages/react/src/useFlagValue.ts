import { useContext, useMemo } from 'react'
import { FlagifyContext } from './context'
import { useFlagifyClient } from './useFlagifyClient'

export function useFlagValue<T>(flagKey: string, fallback: T): T | undefined {
  const { version, isReady } = useContext(FlagifyContext)
  const client = useFlagifyClient()
  return useMemo(() => {
    if (!isReady || !client) return undefined
    return client.getValue<T>(flagKey, fallback)
  }, [client, flagKey, fallback, isReady, version])
}
