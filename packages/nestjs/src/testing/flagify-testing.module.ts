import { DynamicModule, Module } from '@nestjs/common'
import { FLAGIFY_OPTIONS } from '../flagify.constants'
import { FlagifyService } from '../flagify.service'
import { FeatureFlagGuard } from '../guards/feature-flag.guard'

export type MockFlagMap = Record<string, boolean | string | number | Record<string, unknown>>

class MockFlagifyService {
  private flags: MockFlagMap

  constructor(flags: MockFlagMap) {
    this.flags = { ...flags }
  }

  async onModuleInit(): Promise<void> {}
  onModuleDestroy(): void {}

  isReady(): boolean {
    return true
  }

  isEnabled(key: string): boolean {
    return this.flags[key] === true
  }

  getValue<T>(key: string, fallback: T): T {
    return key in this.flags ? (this.flags[key] as T) : fallback
  }

  getVariant(key: string, fallback: string): string {
    return key in this.flags ? String(this.flags[key]) : fallback
  }

  async evaluate(key: string): Promise<{ key: string; value: unknown; reason: string }> {
    return { key, value: this.flags[key] ?? null, reason: 'default' }
  }

  getClient(): null {
    return null
  }

  setFlag(key: string, value: boolean | string | number | Record<string, unknown>): void {
    this.flags[key] = value
  }
}

@Module({})
export class FlagifyTestingModule {
  static withFlags(flags: MockFlagMap = {}): DynamicModule {
    const mockService = new MockFlagifyService(flags)
    return {
      module: FlagifyTestingModule,
      global: true,
      providers: [
        { provide: FLAGIFY_OPTIONS, useValue: {} },
        { provide: FlagifyService, useValue: mockService },
        FeatureFlagGuard,
      ],
      exports: [FlagifyService, FeatureFlagGuard, FLAGIFY_OPTIONS],
    }
  }
}
