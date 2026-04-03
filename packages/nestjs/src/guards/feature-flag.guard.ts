import { Injectable, CanActivate, ExecutionContext, Inject } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { FLAGIFY_OPTIONS, REQUIRE_FLAG_KEY } from '../flagify.constants'
import { FlagifyService } from '../flagify.service'
import type { RequireFlagOptions } from '../decorators/require-flag.decorator'
import type { FlagifyModuleOptions } from '../types/module-options'

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly flagifyService: FlagifyService,
    @Inject(FLAGIFY_OPTIONS) private readonly options: FlagifyModuleOptions,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const flagOptions = this.reflector.get<RequireFlagOptions>(
      REQUIRE_FLAG_KEY,
      context.getHandler(),
    )

    if (!flagOptions) {
      return true
    }

    if (this.options.identify && flagOptions.value !== undefined) {
      const user = await this.options.identify(context)
      const result = await this.flagifyService.evaluate(flagOptions.key, user)
      return result.value === flagOptions.value
    }

    if (flagOptions.value !== undefined) {
      return this.flagifyService.getValue(flagOptions.key, null) === flagOptions.value
    }

    return this.flagifyService.isEnabled(flagOptions.key)
  }
}
