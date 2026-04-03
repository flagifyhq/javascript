import { SetMetadata } from '@nestjs/common'
import { REQUIRE_FLAG_KEY } from '../flagify.constants'

export interface RequireFlagOptions {
  key: string
  value?: unknown
}

export function RequireFlag(key: string): MethodDecorator
export function RequireFlag(options: RequireFlagOptions): MethodDecorator
export function RequireFlag(keyOrOptions: string | RequireFlagOptions): MethodDecorator {
  const options: RequireFlagOptions = typeof keyOrOptions === 'string'
    ? { key: keyOrOptions }
    : keyOrOptions
  return SetMetadata(REQUIRE_FLAG_KEY, options)
}
