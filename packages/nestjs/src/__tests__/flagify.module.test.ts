import { describe, it, expect, vi } from 'vitest'
import { Test } from '@nestjs/testing'
import { FlagifyModule } from '../flagify.module'
import { FlagifyService } from '../flagify.service'
import { FeatureFlagGuard } from '../guards/feature-flag.guard'
import { FLAGIFY_OPTIONS } from '../flagify.constants'
import type { FlagifyModuleOptions } from '../types/module-options'

vi.mock('@flagify/node', () => {
  return {
    Flagify: vi.fn().mockImplementation(function (this: any) {
      this.ready = vi.fn().mockResolvedValue(undefined)
      this.destroy = vi.fn()
      this.isEnabled = vi.fn()
      this.getValue = vi.fn()
      this.getVariant = vi.fn()
      this.evaluate = vi.fn()
    }),
  }
})

describe('FlagifyModule', () => {
  const options: FlagifyModuleOptions = {
    projectKey: 'test-project',
    publicKey: 'pk_test',
  }

  describe('forRoot', () => {
    it('provides FlagifyService and FeatureFlagGuard', async () => {
      const module = await Test.createTestingModule({
        imports: [FlagifyModule.forRoot(options)],
      }).compile()

      const service = module.get(FlagifyService)
      const guard = module.get(FeatureFlagGuard)
      const injectedOptions = module.get(FLAGIFY_OPTIONS)

      expect(service).toBeDefined()
      expect(guard).toBeDefined()
      expect(injectedOptions).toEqual(options)
    })
  })

  describe('forRootAsync', () => {
    it('provides FlagifyService via factory', async () => {
      const module = await Test.createTestingModule({
        imports: [
          FlagifyModule.forRootAsync({
            useFactory: () => options,
          }),
        ],
      }).compile()

      const service = module.get(FlagifyService)
      const injectedOptions = module.get(FLAGIFY_OPTIONS)

      expect(service).toBeDefined()
      expect(injectedOptions).toEqual(options)
    })

    it('supports async factory', async () => {
      const module = await Test.createTestingModule({
        imports: [
          FlagifyModule.forRootAsync({
            useFactory: async () => options,
          }),
        ],
      }).compile()

      const service = module.get(FlagifyService)
      expect(service).toBeDefined()
    })
  })
})
