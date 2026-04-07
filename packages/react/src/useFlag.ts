import { useContext, useMemo } from 'react'
import { FlagifyContext } from './context'
import { useFlagifyClient } from './useFlagifyClient'

export function useFlag(flagKey: string): boolean | undefined {
  const { version, isReady } = useContext(FlagifyContext)
  const client = useFlagifyClient()
  return useMemo(() => {
    if (!isReady || !client) return undefined
    return client.isEnabled(flagKey)
  }, [client, flagKey, isReady, version])
}
