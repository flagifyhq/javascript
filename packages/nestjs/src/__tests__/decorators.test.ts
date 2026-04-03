import { describe, it, expect } from 'vitest'
import { REQUIRE_FLAG_KEY } from '../flagify.constants'
import { RequireFlag } from '../decorators/require-flag.decorator'

describe('RequireFlag decorator', () => {
  it('sets metadata with string key', () => {
    class TestController {
      @RequireFlag('beta-access')
      handler() {}
    }

    const metadata = Reflect.getMetadata(REQUIRE_FLAG_KEY, TestController.prototype.handler)
    expect(metadata).toEqual({ key: 'beta-access' })
  })

  it('sets metadata with options object', () => {
    class TestController {
      @RequireFlag({ key: 'experiment', value: 'variant-a' })
      handler() {}
    }

    const metadata = Reflect.getMetadata(REQUIRE_FLAG_KEY, TestController.prototype.handler)
    expect(metadata).toEqual({ key: 'experiment', value: 'variant-a' })
  })
})
