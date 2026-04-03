import type { ModuleMetadata } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'
import type { FlagifyOptions, FlagifyUser } from '@flagify/node'

export interface FlagifyModuleOptions extends FlagifyOptions {
  /**
   * Extract a FlagifyUser from the current request context.
   * Called by FeatureFlagGuard for per-request evaluation with targeting rules.
   */
  identify?: (context: ExecutionContext) => FlagifyUser | Promise<FlagifyUser>

  /**
   * If true, the module is registered globally (available without importing in every module).
   * Defaults to true.
   */
  isGlobal?: boolean
}

export interface FlagifyModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  /**
   * If true, the module is registered globally.
   * Defaults to true.
   */
  isGlobal?: boolean

  /**
   * Factory function that returns FlagifyModuleOptions.
   */
  useFactory: (...args: any[]) => FlagifyModuleOptions | Promise<FlagifyModuleOptions>

  /**
   * Dependencies to inject into the factory function.
   */
  inject?: any[]
}
