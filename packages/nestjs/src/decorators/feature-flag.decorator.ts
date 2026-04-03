import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { FlagifyService } from '../flagify.service'

export interface FeatureFlagParamOptions {
  key: string
  fallback?: unknown
}

/**
 * Parameter decorator that resolves a feature flag value at request time.
 * Requires FlagifyModule to be imported (registers middleware that attaches the service to the request).
 *
 * @example
 * @Get('dashboard')
 * getDashboard(@FeatureFlag('new-dashboard') isNew: boolean) { ... }
 *
 * @example
 * @Get('products')
 * getProducts(@FeatureFlag({ key: 'max-results', fallback: 20 }) max: number) { ... }
 */
export const FeatureFlag = createParamDecorator(
  (data: string | FeatureFlagParamOptions, ctx: ExecutionContext) => {
    const options: FeatureFlagParamOptions = typeof data === 'string'
      ? { key: data }
      : data

    const request = ctx.switchToHttp().getRequest()
    const flagifyService: FlagifyService | undefined = request.__flagifyService

    if (!flagifyService) {
      return options.fallback ?? null
    }

    if (options.fallback !== undefined) {
      return flagifyService.getValue(options.key, options.fallback)
    }

    return flagifyService.isEnabled(options.key)
  },
)
