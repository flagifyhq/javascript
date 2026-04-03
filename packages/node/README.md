<p align="center">
  <a href="https://flagify.dev">
    <img alt="Flagify" src="https://flagify.dev/logo-color.svg" width="280" />
  </a>
</p>

<p align="center">
  <strong>Feature flags for modern teams</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@flagify/node"><img src="https://img.shields.io/npm/v/@flagify/node.svg?style=flat-square&color=0D80F9" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@flagify/node"><img src="https://img.shields.io/npm/dm/@flagify/node.svg?style=flat-square&color=0D80F9" alt="npm downloads" /></a>
  <a href="https://github.com/flagifyhq/javascript/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@flagify/node.svg?style=flat-square&color=0D80F9" alt="license" /></a>
  <a href="https://github.com/flagifyhq/javascript"><img src="https://img.shields.io/github/stars/flagifyhq/javascript?style=flat-square&color=0D80F9" alt="github stars" /></a>
</p>

<p align="center">
  <a href="https://flagify.dev/docs">Documentation</a> &middot;
  <a href="https://flagify.dev/docs/sdks/node">SDK Reference</a> &middot;
  <a href="https://github.com/flagifyhq/javascript/issues">Issues</a> &middot;
  <a href="https://flagify.dev">Website</a>
</p>

---

## Overview

`@flagify/node` is the official Node.js SDK for [Flagify](https://flagify.dev). TypeScript-first, with in-memory caching and sub-millisecond flag evaluation.

- **TypeScript-first** -- Full type safety with generics support
- **In-memory cache** -- Sub-millisecond evaluations after initial sync
- **Stale-while-revalidate** -- Serves cached values while refreshing in the background
- **Lightweight** -- Zero runtime dependencies (except `dotenv`)
- **Isomorphic** -- ESM and CommonJS output

## Table of contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [API reference](#api-reference)
- [How it works](#how-it-works)
- [Environment variables](#environment-variables)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
# pnpm
pnpm add @flagify/node

# npm
npm install @flagify/node

# yarn
yarn add @flagify/node
```

## Quick start

```typescript
import { Flagify } from '@flagify/node'

const flagify = new Flagify({
  projectKey: 'proj_xxx',
  publicKey: 'pk_xxx',
})

// Boolean flag
if (flagify.isEnabled('new-checkout')) {
  showNewCheckout()
}

// Typed value
const limit = flagify.getValue<number>('rate-limit')
```

## Configuration

```typescript
import { Flagify } from '@flagify/node'

const flagify = new Flagify({
  // Required
  projectKey: 'proj_xxx',
  publicKey: 'pk_xxx',

  // Optional -- server-side only, never expose in client bundles
  secretKey: 'sk_xxx',

  options: {
    // Custom API endpoint (defaults to https://api.flagify.dev)
    apiUrl: 'https://api.flagify.dev',

    // Cache TTL in ms (default: 5 minutes)
    staleTimeMs: 300_000,

    // Real-time updates via SSE (coming soon)
    realtime: false,

    // User context for targeting rules
    user: {
      id: 'user_123',
      email: 'mario@example.com',
      role: 'admin',
      group: 'engineering',
      geolocation: {
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
      },
      // Custom attributes
      plan: 'enterprise',
      companySize: 50,
    },
  },
})
```

### Configuration options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `projectKey` | `string` | Yes | -- | Project identifier from your Flagify workspace |
| `publicKey` | `string` | Yes | -- | Client-safe publishable API key |
| `secretKey` | `string` | No | -- | Server-side secret key |
| `options.apiUrl` | `string` | No | `https://api.flagify.dev` | Custom API base URL |
| `options.staleTimeMs` | `number` | No | `300000` | Cache staleness threshold in ms |
| `options.realtime` | `boolean` | No | `false` | Enable real-time SSE updates |
| `options.pollIntervalMs` | `number` | No | -- | Polling interval in ms for periodic flag sync |
| `options.user` | `FlagifyUser` | No | -- | User context for targeting |

## API reference

### `new Flagify(config: FlagifyOptions)`

Creates a new Flagify client. Immediately fetches all flags and populates the local cache.

```typescript
const flagify = new Flagify({
  projectKey: 'proj_xxx',
  publicKey: 'pk_xxx',
})
```

---

### `flagify.isEnabled(flagKey: string): boolean`

Evaluates a boolean feature flag.

Returns `false` when:
- The flag does not exist
- The flag is disabled
- The flag type is not `boolean`

```typescript
if (flagify.isEnabled('dark-mode')) {
  applyDarkTheme()
}
```

---

### `flagify.getValue<T>(flagKey: string, fallback: T): T`

Returns the resolved value of a feature flag with a typed fallback.

```typescript
// String variant
const variant = flagify.getValue<string>('checkout-flow', 'control')

// Number
const limit = flagify.getValue<number>('rate-limit', 100)

// JSON object
const config = flagify.getValue<{ maxRetries: number; timeout: number }>('api-config', {
  maxRetries: 3,
  timeout: 5000,
})
```

---

### `flagify.getVariant(flagKey: string, fallback: string): string`

Returns the string variant of a multivariate flag. Returns the variant with the highest weight, or the fallback if the flag has no variants or is disabled.

```typescript
const variant = flagify.getVariant('checkout-flow', 'control')
```

---

### `flagify.evaluate(flagKey: string, user: FlagifyUser): Promise<EvaluateResult>`

Server-side evaluation with user targeting. Calls the Flagify API with user context for targeting rules.

```typescript
const result = await flagify.evaluate('premium-feature', {
  id: 'user_123',
  email: 'mario@example.com',
  role: 'admin',
})
// result: { key: 'premium-feature', value: true, reason: 'targeting_rule' }
```

---

### `flagify.ready(): Promise<void>`

Resolves when the initial flag sync is complete. Useful in server startup sequences.

```typescript
const flagify = new Flagify({ projectKey: 'proj_xxx', publicKey: 'pk_xxx' })
await flagify.ready()
```

---

### `flagify.destroy(): void`

Disconnects the realtime listener, stops polling, and cleans up resources.

```typescript
flagify.destroy()
```

---

### `flagify.onFlagChange`

Callback invoked when a flag changes via SSE or background refetch.

```typescript
flagify.onFlagChange = (event) => {
  console.log(`Flag ${event.flagKey} was ${event.action}`)
}
```

## How it works

```
  Init                    Evaluate               Stale?
  ----                    --------               ------
  GET /v1/flags    -->    Read from cache   -->  Background refetch
  Cache all flags         Sub-ms response        GET /v1/flags/:key
                                                 Return stale value immediately
```

1. On initialization, the client syncs all flags from `GET /v1/flags`
2. All evaluations read from the in-memory `Map` cache -- sub-millisecond
3. When a flag exceeds `staleTimeMs`, the stale value is returned immediately while a background `GET /v1/flags/:key` refreshes the cache
4. If the API is unreachable, the client falls back to cached defaults

## Environment variables

| Variable | Description |
|----------|-------------|
| `FLAGIFY_API_URL` | Override the default API base URL |

## Types

All types are exported for convenience:

```typescript
import type {
  FlagifyOptions,
  FlagifyUser,
  FlagifyFlaggy,
  IFlagifyClient,
  EvaluateResult,
  FlagChangeEvent,
  RealtimeEvents,
  RealtimeListener,
} from '@flagify/node'
```

## Contributing

We welcome contributions. Please open an issue first to discuss what you'd like to change.

```bash
# Clone
git clone https://github.com/flagifyhq/javascript.git
cd javascript

# Install
pnpm install

# Development
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
