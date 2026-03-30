import { useContext } from 'react'
import { FlagifyContext } from './context'
import { useFlagifyClient } from './useFlagifyClient'

export function useFlagValue<T>(flagKey: string, fallback: T): T {
  const { version } = useContext(FlagifyContext)
  const client = useFlagifyClient()
  void version
  return client.getValue<T>(flagKey, fallback)
}
