import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FlagifyService } from '../flagify.service'
import { Flagify } from '@flagify/node'
import type { FlagifyModuleOptions } from '../types/module-options'

vi.mock('@flagify/node', () => {
  return {
    Flagify: vi.fn().mockImplementation(function (this: any) {
      this.ready = vi.fn().mockResolvedValue(undefined)
      this.destroy = vi.fn()
      this.isEnabled = vi.fn().mockReturnValue(true)
      this.getValue = vi.fn().mockReturnValue('test-value')
      this.getVariant = vi.fn().mockReturnValue('variant-a')
      this.evaluate = vi.fn().mockResolvedValue({ key: 'flag', value: true, reason: 'default' })
    }),
  }
})

describe('FlagifyService', () => {
  let service: FlagifyService
  let mockClient: any
  const options: FlagifyModuleOptions = {
    projectKey: 'test-project',
    publicKey: 'pk_test',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    service = new FlagifyService(options)
    mockClient = service.getClient()
  })

  it('creates a Flagify client with provided options', () => {
    expect(Flagify).toHaveBeenCalledWith(options)
  })

  describe('onModuleInit', () => {
    it('calls client.ready() and sets isReady to true', async () => {
      expect(service.isReady()).toBe(false)
      await service.onModuleInit()
      expect(mockClient.ready).toHaveBeenCalled()
      expect(service.isReady()).toBe(true)
    })
  })

  describe('onModuleDestroy', () => {
    it('calls client.destroy()', () => {
      service.onModuleDestroy()
      expect(mockClient.destroy).toHaveBeenCalled()
    })
  })

  describe('isEnabled', () => {
    it('delegates to client.isEnabled()', () => {
      const result = service.isEnabled('my-flag')
      expect(mockClient.isEnabled).toHaveBeenCalledWith('my-flag')
      expect(result).toBe(true)
    })
  })

  describe('getValue', () => {
    it('delegates to client.getValue() with fallback', () => {
      const result = service.getValue('my-flag', 'fallback')
      expect(mockClient.getValue).toHaveBeenCalledWith('my-flag', 'fallback')
      expect(result).toBe('test-value')
    })
  })

  describe('getVariant', () => {
    it('delegates to client.getVariant() with fallback', () => {
      const result = service.getVariant('my-flag', 'control')
      expect(mockClient.getVariant).toHaveBeenCalledWith('my-flag', 'control')
      expect(result).toBe('variant-a')
    })
  })

  describe('evaluate', () => {
    it('delegates to client.evaluate() with user context', async () => {
      const user = { id: 'user-1', email: 'test@test.com' }
      const result = await service.evaluate('my-flag', user)
      expect(mockClient.evaluate).toHaveBeenCalledWith('my-flag', user)
      expect(result).toEqual({ key: 'flag', value: true, reason: 'default' })
    })
  })

  describe('getClient', () => {
    it('returns the underlying Flagify instance', () => {
      expect(service.getClient()).toBe(mockClient)
    })
  })
})
