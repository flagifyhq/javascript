import { useFlagifyClient } from './useFlagifyClient'

export function useFlag(flagKey: string): boolean {
  const client = useFlagifyClient()
  return client.isEnabled(flagKey)
}
