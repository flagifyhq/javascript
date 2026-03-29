import { useState, useEffect, type ReactNode } from 'react'
import { Flagify, type FlagifyOptions } from '@flagify/node'
import { FlagifyContext } from './context'

export interface FlagifyProviderProps extends FlagifyOptions {
  children: ReactNode
}

export function FlagifyProvider({ children, ...config }: FlagifyProviderProps) {
  const [client, setClient] = useState<Flagify | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const instance = new Flagify(config)
    setClient(instance)
    setIsReady(true)
  }, [config.projectKey, config.publicKey])

  return (
    <FlagifyContext.Provider value={{ client, isReady }}>
      {children}
    </FlagifyContext.Provider>
  )
}
