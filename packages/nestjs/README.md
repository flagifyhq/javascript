<p align="center">
  <a href="https://flagify.dev">
    <img alt="Flagify" src="https://flagify.dev/logo-color.svg" width="280" />
  </a>
</p>

<p align="center">
  <strong>Feature flags for modern teams</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@flagify/nestjs"><img src="https://img.shields.io/npm/v/@flagify/nestjs.svg?style=flat-square&color=0D80F9" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@flagify/nestjs"><img src="https://img.shields.io/npm/dm/@flagify/nestjs.svg?style=flat-square&color=0D80F9" alt="npm downloads" /></a>
  <a href="https://github.com/flagifyhq/javascript/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@flagify/nestjs.svg?style=flat-square&color=0D80F9" alt="license" /></a>
  <a href="https://github.com/flagifyhq/javascript"><img src="https://img.shields.io/github/stars/flagifyhq/javascript?style=flat-square&color=0D80F9" alt="github stars" /></a>
</p>

<p align="center">
  <a href="https://flagify.dev/docs">Documentation</a> &middot;
  <a href="https://flagify.dev/docs/sdks/nestjs">SDK Reference</a> &middot;
  <a href="https://github.com/flagifyhq/javascript/issues">Issues</a> &middot;
  <a href="https://flagify.dev">Website</a>
</p>

---

## Overview

`@flagify/nestjs` is the official NestJS integration for [Flagify](https://flagify.dev). A full-featured module with service, guard, and decorators for feature flag evaluation in NestJS applications.

- **NestJS-native** -- Dynamic module with `forRoot` / `forRootAsync` registration
- **Injectable service** -- `FlagifyService` with `isEnabled`, `getValue`, `getVariant`, and `evaluate`
- **Route guard** -- `FeatureFlagGuard` + `@RequireFlag()` decorator to gate endpoints
- **Param decorator** -- `@FeatureFlag()` to inject flag values into route handlers
- **User targeting** -- `identify` callback for per-request evaluation with targeting rules
- **Testing module** -- `FlagifyTestingModule.withFlags()` for unit tests without HTTP calls
- **TypeScript-first** -- Full type safety with generics

## Table of contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Module registration](#module-registration)
- [Service](#service)
- [Guard and decorators](#guard-and-decorators)
- [Testing](#testing)
- [API reference](#api-reference)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
# pnpm
pnpm add @flagify/nestjs

# npm
npm install @flagify/nestjs

# yarn
yarn add @flagify/nestjs
```

> **Peer dependencies:** `@nestjs/common` >= 10, `@nestjs/core` >= 10, `reflect-metadata` >= 0.1.13

## Quick start

**1. Register the module**

```typescript
import { Module } from '@nestjs/common'
import { FlagifyModule } from '@flagify/nestjs'

@Module({
  imports: [
    FlagifyModule.forRoot({
      projectKey: 'proj_xxx',
      publicKey: 'pk_xxx',
    }),
  ],
})
export class AppModule {}
```

**2. Inject the service**

```typescript
import { Injectable } from '@nestjs/common'
import { FlagifyService } from '@flagify/nestjs'

@Injectable()
export class PaymentService {
  constructor(private readonly flagify: FlagifyService) {}

  checkout() {
    if (this.flagify.isEnabled('new-checkout')) {
      return this.newCheckout()
    }
    return this.legacyCheckout()
  }
}
```

**3. Gate a route with a decorator**

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common'
import { FeatureFlagGuard, RequireFlag } from '@flagify/nestjs'

@Controller('experiments')
@UseGuards(FeatureFlagGuard)
export class ExperimentsController {
  @Get()
  @RequireFlag('experiments-enabled')
  getExperiments() {
    return { experiments: [] }
  }
}
```

## Module registration

### `FlagifyModule.forRoot(options)`

Synchronous registration. The module is global by default (`isGlobal: true`).

```typescript
FlagifyModule.forRoot({
  projectKey: 'proj_xxx',
  publicKey: 'pk_xxx',
  secretKey: 'sk_xxx',
  isGlobal: true,
  identify: (context) => {
    const request = context.switchToHttp().getRequest()
    return { id: request.user.id, email: request.user.email }
  },
  options: {
    apiUrl: 'https://api.flagify.dev',
    staleTimeMs: 300_000,
  },
})
```

### `FlagifyModule.forRootAsync(asyncOptions)`

Async registration for when options depend on other providers (e.g. `ConfigService`).

```typescript
FlagifyModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    projectKey: config.get('FLAGIFY_PROJECT_KEY'),
    publicKey: config.get('FLAGIFY_PUBLIC_KEY'),
    secretKey: config.get('FLAGIFY_SECRET_KEY'),
    identify: (context) => {
      const req = context.switchToHttp().getRequest()
      return { id: req.user.id }
    },
  }),
})
```

### Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `projectKey` | `string` | Yes | -- | Project identifier from your Flagify workspace |
| `publicKey` | `string` | Yes | -- | Client-safe publishable API key |
| `secretKey` | `string` | No | -- | Server-side secret key |
| `isGlobal` | `boolean` | No | `true` | Register the module globally |
| `identify` | `(context: ExecutionContext) => FlagifyUser` | No | -- | Extract user context from requests for targeting |
| `options` | `object` | No | -- | Additional config (`apiUrl`, `staleTimeMs`, `realtime`, `user`) |

## Service

### `FlagifyService`

Injectable service that wraps the `@flagify/node` client. Initializes on module init and destroys on module destroy.

```typescript
import { FlagifyService } from '@flagify/nestjs'

@Injectable()
export class MyService {
  constructor(private readonly flagify: FlagifyService) {}
}
```

#### Methods

---

#### `isReady(): boolean`

Returns `true` once the client has completed its initial flag sync.

---

#### `isEnabled(flagKey: string): boolean`

Evaluates a boolean feature flag. Returns `false` if the flag doesn't exist, is disabled, or is not a boolean type.

```typescript
if (this.flagify.isEnabled('dark-mode')) {
  applyDarkTheme()
}
```

---

#### `getValue<T>(flagKey: string, fallback: T): T`

Returns the resolved value of a feature flag with a fallback.

```typescript
const limit = this.flagify.getValue<number>('rate-limit', 100)
```

---

#### `getVariant(flagKey: string, fallback: string): string`

Returns the string variant of a multivariate flag.

```typescript
const variant = this.flagify.getVariant('checkout-flow', 'control')
```

---

#### `evaluate(flagKey: string, user: FlagifyUser): Promise<EvaluateResult>`

Server-side evaluation with user targeting. Calls the Flagify API with user context.

```typescript
const result = await this.flagify.evaluate('premium-feature', {
  id: 'user_123',
  email: 'mario@example.com',
  role: 'admin',
})
// result: { key: 'premium-feature', value: true, reason: 'targeting_rule' }
```

---

#### `getClient(): Flagify`

Returns the underlying `@flagify/node` client instance for advanced use cases.

## Guard and decorators

### `@RequireFlag(key)` + `FeatureFlagGuard`

Gate routes behind a feature flag. The guard reads metadata set by `@RequireFlag` and checks the flag state.

```typescript
@Controller('beta')
@UseGuards(FeatureFlagGuard)
export class BetaController {
  // Only accessible when 'beta-access' is enabled
  @Get()
  @RequireFlag('beta-access')
  getBeta() {
    return { status: 'welcome to beta' }
  }

  // Only accessible when 'checkout-flow' equals 'variant-b'
  @Get('checkout')
  @RequireFlag({ key: 'checkout-flow', value: 'variant-b' })
  getNewCheckout() {
    return { flow: 'variant-b' }
  }
}
```

When `identify` is configured in the module options and `value` is specified, the guard performs a server-side evaluation with the user's context.

### `@FeatureFlag(key)`

Parameter decorator that injects a flag value into a route handler.

```typescript
@Controller('dashboard')
export class DashboardController {
  // Boolean flag — resolves via isEnabled()
  @Get()
  getDashboard(@FeatureFlag('new-dashboard') isNew: boolean) {
    return isNew ? { layout: 'v2' } : { layout: 'v1' }
  }

  // Typed value with fallback — resolves via getValue()
  @Get('products')
  getProducts(@FeatureFlag({ key: 'max-results', fallback: 20 }) max: number) {
    return { maxResults: max }
  }
}
```

## Testing

### `FlagifyTestingModule`

A drop-in replacement for `FlagifyModule` that uses in-memory mock flags. No HTTP calls, no API keys needed.

```typescript
import { Test } from '@nestjs/testing'
import { FlagifyTestingModule, FlagifyService } from '@flagify/nestjs'

const module = await Test.createTestingModule({
  imports: [
    FlagifyTestingModule.withFlags({
      'new-checkout': true,
      'rate-limit': 50,
      'checkout-flow': 'variant-a',
    }),
  ],
  providers: [PaymentService],
}).compile()

const flagify = module.get(FlagifyService)

flagify.isEnabled('new-checkout')       // true
flagify.getValue('rate-limit', 100)     // 50
flagify.getVariant('checkout-flow', '') // 'variant-a'
```

Import the testing module from the `@flagify/nestjs/testing` entrypoint or directly from `@flagify/nestjs`.

## API reference

| Export | Type | Description |
|--------|------|-------------|
| `FlagifyModule` | Module | Dynamic module -- `forRoot()` / `forRootAsync()` |
| `FlagifyService` | Service | Injectable service for flag evaluation |
| `FeatureFlagGuard` | Guard | Route guard that checks `@RequireFlag` metadata |
| `RequireFlag` | Decorator | Method decorator to gate routes behind a flag |
| `FeatureFlag` | Decorator | Parameter decorator to inject flag values |
| `FlagifyTestingModule` | Module | Testing module with mock flags |
| `FlagifyModuleOptions` | Type | Options for `forRoot()` |
| `FlagifyModuleAsyncOptions` | Type | Options for `forRootAsync()` |
| `RequireFlagOptions` | Type | Options for `@RequireFlag()` |
| `FeatureFlagParamOptions` | Type | Options for `@FeatureFlag()` |
| `MockFlagMap` | Type | Flag map for `FlagifyTestingModule.withFlags()` |
| `FLAGIFY_OPTIONS` | Symbol | Injection token for module options |
| `REQUIRE_FLAG_KEY` | String | Metadata key used by `@RequireFlag` |

## Contributing

We welcome contributions. Please open an issue first to discuss what you'd like to change.

```bash
# Clone
git clone https://github.com/flagifyhq/javascript.git
cd javascript

# Install
pnpm install

# Development (watch mode)
pnpm run dev

# Build
pnpm run build
```

## License

MIT -- see [LICENSE](./LICENSE) for details.

---

<p align="center">
  <sub>Built with care by the <a href="https://flagify.dev">Flagify</a> team</sub>
</p>
