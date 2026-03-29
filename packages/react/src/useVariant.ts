import { useFlagifyClient } from './useFlagifyClient'

export function useVariant(flagKey: string): string | undefined {
  const client = useFlagifyClient()
  return client.getValue<string>(flagKey)
}
