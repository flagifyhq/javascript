import { useFlagifyClient } from './useFlagifyClient'

export function useFlagValue<T = unknown>(flagKey: string): T | undefined {
  const client = useFlagifyClient()
  return client.getValue<T>(flagKey)
}
