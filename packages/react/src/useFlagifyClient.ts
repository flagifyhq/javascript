import { useContext, useRef } from 'react'
import { FlagifyContext, NO_PROVIDER } from './context'

export function useFlagifyClient() {
  const ctx = useContext(FlagifyContext)
  const hasWarned = useRef(false)

  if (ctx === NO_PROVIDER) {
    if (!hasWarned.current) {
      hasWarned.current = true
      console.warn(
        '[Flagify] No <FlagifyProvider> found. Hooks will return fallback values. ' +
          'Wrap your app with <FlagifyProvider> to enable feature flags.'
      )
    }
    return null
  }
  return ctx.client
}
