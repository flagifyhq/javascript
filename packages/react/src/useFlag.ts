import { useContext } from 'react'
import { FlagifyContext } from './context'
import { useFlagifyClient } from './useFlagifyClient'

export function useFlag(flagKey: string): boolean {
  const { version } = useContext(FlagifyContext)
  const client = useFlagifyClient()
  void version
  return client?.isEnabled(flagKey) ?? false
}
