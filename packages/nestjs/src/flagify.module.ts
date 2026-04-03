import { Module, DynamicModule, MiddlewareConsumer, NestModule } from '@nestjs/common'
import type { NestMiddleware } from '@nestjs/common'
import type { Request, Response, NextFunction } from 'express'
import { FLAGIFY_OPTIONS } from './flagify.constants'
import { FlagifyService } from './flagify.service'
import { FeatureFlagGuard } from './guards/feature-flag.guard'
import type { FlagifyModuleOptions, FlagifyModuleAsyncOptions } from './types/module-options'

@Module({})
export class FlagifyModule implements NestModule {
  constructor(private readonly flagifyService: FlagifyService) {}

  configure(consumer: MiddlewareConsumer) {
    const service = this.flagifyService
    consumer
      .apply(
        class implements NestMiddleware {
          use(req: Request, _res: Response, next: NextFunction) {
            ;(req as any).__flagifyService = service
            next()
          }
        },
      )
      .forRoutes('*')
  }

  static forRoot(options: FlagifyModuleOptions): DynamicModule {
    const isGlobal = options.isGlobal !== false
    return {
      module: FlagifyModule,
      global: isGlobal,
      providers: [
        { provide: FLAGIFY_OPTIONS, useValue: options },
        FlagifyService,
        FeatureFlagGuard,
      ],
      exports: [FlagifyService, FeatureFlagGuard, FLAGIFY_OPTIONS],
    }
  }

  static forRootAsync(asyncOptions: FlagifyModuleAsyncOptions): DynamicModule {
    const isGlobal = asyncOptions.isGlobal !== false
    return {
      module: FlagifyModule,
      global: isGlobal,
      imports: asyncOptions.imports || [],
      providers: [
        {
          provide: FLAGIFY_OPTIONS,
          useFactory: asyncOptions.useFactory,
          inject: asyncOptions.inject || [],
        },
        FlagifyService,
        FeatureFlagGuard,
      ],
      exports: [FlagifyService, FeatureFlagGuard, FLAGIFY_OPTIONS],
    }
  }
}
