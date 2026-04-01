import { useContext } from 'react'
import { FlagifyContext } from './context'

export function useFlagifyClient() {
  const ctx = useContext(FlagifyContext)
  return ctx.client
}
