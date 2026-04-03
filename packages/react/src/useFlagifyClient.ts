import { useContext } from 'react'
import { FlagifyContext, NO_PROVIDER } from './context'

export function useFlagifyClient() {
  const ctx = useContext(FlagifyContext)
  if (ctx === NO_PROVIDER) {
    throw new Error(
      'useFlagifyClient must be used within a <FlagifyProvider>. ' +
        'Wrap your app with <FlagifyProvider client={client}>.'
    )
  }
  return ctx.client
}
