import { describe, it, expect } from 'vitest'
import { Test } from '@nestjs/testing'
import { FlagifyTestingModule } from '../testing/flagify-testing.module'
import { FlagifyService } from '../flagify.service'

describe('FlagifyTestingModule', () => {
  it('provides a mock FlagifyService with given flags', async () => {
    const module = await Test.createTestingModule({
      imports: [
        FlagifyTestingModule.withFlags({
          'beta-access': true,
          'max-items': 25,
          'experiment': 'variant-a',
        }),
      ],
    }).compile()

    const service = module.get(FlagifyService)

    expect(service.isReady()).toBe(true)
    expect(service.isEnabled('beta-access')).toBe(true)
    expect(service.isEnabled('nonexistent')).toBe(false)
    expect(service.getValue('max-items', 10)).toBe(25)
    expect(service.getValue('missing', 10)).toBe(10)
    expect(service.getVariant('experiment', 'control')).toBe('variant-a')
    expect(service.getVariant('missing', 'control')).toBe('control')
  })

  it('evaluate returns flag value from map', async () => {
    const module = await Test.createTestingModule({
      imports: [
        FlagifyTestingModule.withFlags({ 'my-flag': true }),
      ],
    }).compile()

    const service = module.get(FlagifyService)
    const result = await service.evaluate('my-flag', { id: 'user-1' })
    expect(result).toEqual({ key: 'my-flag', value: true, reason: 'default' })
  })

  it('setFlag updates flags mid-test', async () => {
    const module = await Test.createTestingModule({
      imports: [
        FlagifyTestingModule.withFlags({ 'my-flag': false }),
      ],
    }).compile()

    const service = module.get(FlagifyService) as any
    expect(service.isEnabled('my-flag')).toBe(false)

    service.setFlag('my-flag', true)
    expect(service.isEnabled('my-flag')).toBe(true)
  })

  it('getClient returns null in testing mode', async () => {
    const module = await Test.createTestingModule({
      imports: [FlagifyTestingModule.withFlags()],
    }).compile()

    const service = module.get(FlagifyService)
    expect(service.getClient()).toBeNull()
  })
})
