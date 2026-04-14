import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { Flagify, type FlagifyOptions } from '@flagify/node'
import { FlagifyContext } from './context'

export interface FlagifyProviderProps extends Omit<FlagifyOptions, 'secretKey'> {
  children: ReactNode
}

export function FlagifyProvider({ children, ...config }: FlagifyProviderProps) {
  if (typeof window !== 'undefined') {
    const leaked = (config as FlagifyOptions).secretKey
    if (leaked || config.publicKey?.startsWith('sk_')) {
      console.error(
        '[Flagify] A secret key (sk_*) was passed to <FlagifyProvider>. ' +
          'Secret keys are server-only and must never be sent to the browser. ' +
          'Use your public key (pk_*) instead.',
      )
    }
  }

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
  }, [config.projectKey, config.publicKey, config.options?.user?.id, config.options?.realtime, config.options?.pollIntervalMs, config.options?.apiUrl])

  return (
    <FlagifyContext.Provider value={{ client, isReady, version }}>
      {children}
    </FlagifyContext.Provider>
  )
}
