import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { Flagify, type FlagifyOptions } from '@flagify/node'
import { FlagifyContext } from './context'

export interface FlagifyProviderProps extends FlagifyOptions {
  children: ReactNode
}

export function FlagifyProvider({ children, ...config }: FlagifyProviderProps) {
  const [client, setClient] = useState<Flagify | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [version, setVersion] = useState(0)
  const clientRef = useRef<Flagify | null>(null)

  const bumpVersion = useCallback(() => {
    setVersion((v) => v + 1)
  }, [])

  useEffect(() => {
    let instance: Flagify

    try {
      instance = new Flagify(config)
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err))
      return
    }

    clientRef.current = instance

    const unsubscribe = instance.onFlagChange(bumpVersion)

    instance.ready().then(() => {
      // Only set state if this instance is still current
      if (clientRef.current === instance) {
        setClient(instance)
        setIsReady(true)
      }
    })

    return () => {
      clientRef.current = null
      unsubscribe()
      instance.destroy()
    }
  }, [config.projectKey, config.publicKey, config.secretKey, config.options?.user?.id, config.options?.realtime, config.options?.pollIntervalMs, config.options?.apiUrl])

  return (
    <FlagifyContext.Provider value={{ client, isReady, version }}>
      {children}
    </FlagifyContext.Provider>
  )
}
