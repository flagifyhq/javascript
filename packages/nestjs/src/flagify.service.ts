import { Injectable, Inject, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { Flagify } from '@flagify/node'
import type { FlagifyUser, EvaluateResult } from '@flagify/node'
import { FLAGIFY_OPTIONS } from './flagify.constants'
import type { FlagifyModuleOptions } from './types/module-options'

@Injectable()
export class FlagifyService implements OnModuleInit, OnModuleDestroy {
  private client: Flagify
  private _ready = false
  private readonly logger = new Logger(FlagifyService.name)

  constructor(
    @Inject(FLAGIFY_OPTIONS) private readonly options: FlagifyModuleOptions,
  ) {
    this.client = new Flagify(options)
  }

  async onModuleInit(): Promise<void> {
    await this.client.ready()
    this._ready = true
    this.logger.log('Flagify client initialized and flags synced')
  }

  onModuleDestroy(): void {
    this.client.destroy()
    this.logger.log('Flagify client destroyed')
  }

  isReady(): boolean {
    return this._ready
  }

  isEnabled(flagKey: string): boolean {
    return this.client.isEnabled(flagKey)
  }

  getValue<T>(flagKey: string, fallback: T): T {
    return this.client.getValue(flagKey, fallback)
  }

  getVariant(flagKey: string, fallback: string): string {
    return this.client.getVariant(flagKey, fallback)
  }

  async evaluate(flagKey: string, user: FlagifyUser): Promise<EvaluateResult> {
    return this.client.evaluate(flagKey, user)
  }

  getClient(): Flagify {
    return this.client
  }
}
