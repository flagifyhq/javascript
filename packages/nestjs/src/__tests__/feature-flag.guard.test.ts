import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Reflector } from '@nestjs/core'
import { FeatureFlagGuard } from '../guards/feature-flag.guard'
import { FlagifyService } from '../flagify.service'
import { REQUIRE_FLAG_KEY } from '../flagify.constants'
import type { FlagifyModuleOptions } from '../types/module-options'
import type { ExecutionContext } from '@nestjs/common'

function createMockContext(): ExecutionContext {
  return {
    getHandler: vi.fn().mockReturnValue(() => {}),
    getClass: vi.fn(),
    switchToHttp: vi.fn().mockReturnValue({
      getRequest: vi.fn().mockReturnValue({}),
    }),
  } as unknown as ExecutionContext
}

describe('FeatureFlagGuard', () => {
  let guard: FeatureFlagGuard
  let reflector: Reflector
  let flagifyService: Partial<FlagifyService>
  let options: FlagifyModuleOptions

  beforeEach(() => {
    reflector = new Reflector()
    flagifyService = {
      isEnabled: vi.fn().mockReturnValue(false),
      getValue: vi.fn().mockReturnValue(null),
      evaluate: vi.fn().mockResolvedValue({ key: 'flag', value: 'variant-a', reason: 'default' }),
    }
    options = { projectKey: 'test', publicKey: 'pk_test' }
    guard = new FeatureFlagGuard(reflector, flagifyService as FlagifyService, options)
  })

  it('allows access when no @RequireFlag metadata is present', async () => {
    vi.spyOn(reflector, 'get').mockReturnValue(undefined)
    const ctx = createMockContext()
    expect(await guard.canActivate(ctx)).toBe(true)
  })

  it('checks isEnabled when only key is provided', async () => {
    vi.spyOn(reflector, 'get').mockReturnValue({ key: 'beta-access' })
    ;(flagifyService.isEnabled as any).mockReturnValue(true)

    const ctx = createMockContext()
    expect(await guard.canActivate(ctx)).toBe(true)
    expect(flagifyService.isEnabled).toHaveBeenCalledWith('beta-access')
  })

  it('denies access when flag is disabled', async () => {
    vi.spyOn(reflector, 'get').mockReturnValue({ key: 'beta-access' })
    ;(flagifyService.isEnabled as any).mockReturnValue(false)

    const ctx = createMockContext()
    expect(await guard.canActivate(ctx)).toBe(false)
  })

  it('checks getValue when value option is provided', async () => {
    vi.spyOn(reflector, 'get').mockReturnValue({ key: 'experiment', value: 'variant-a' })
    ;(flagifyService.getValue as any).mockReturnValue('variant-a')

    const ctx = createMockContext()
    expect(await guard.canActivate(ctx)).toBe(true)
    expect(flagifyService.getValue).toHaveBeenCalledWith('experiment', null)
  })

  it('denies access when value does not match', async () => {
    vi.spyOn(reflector, 'get').mockReturnValue({ key: 'experiment', value: 'variant-a' })
    ;(flagifyService.getValue as any).mockReturnValue('variant-b')

    const ctx = createMockContext()
    expect(await guard.canActivate(ctx)).toBe(false)
  })

  it('uses evaluate with identify callback when both are present', async () => {
    const user = { id: 'user-1' }
    options.identify = vi.fn().mockResolvedValue(user)
    guard = new FeatureFlagGuard(reflector, flagifyService as FlagifyService, options)

    vi.spyOn(reflector, 'get').mockReturnValue({ key: 'experiment', value: 'variant-a' })

    const ctx = createMockContext()
    expect(await guard.canActivate(ctx)).toBe(true)
    expect(options.identify).toHaveBeenCalledWith(ctx)
    expect(flagifyService.evaluate).toHaveBeenCalledWith('experiment', user)
  })
})
