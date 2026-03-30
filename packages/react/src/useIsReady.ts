import { useContext } from 'react'
import { FlagifyContext } from './context'

export function useIsReady(): boolean {
  const { isReady } = useContext(FlagifyContext)
  return isReady
}
