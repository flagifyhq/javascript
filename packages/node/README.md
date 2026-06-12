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
- **Runtime-friendly** -- Runs on Node.js, modern browsers, edge runtimes, and **React Native (Hermes engine)**

## Table of contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Supported runtimes](#supported-runtimes)
- [Configuration](#configuration)
- [User context & targeting](#user-context--targeting)
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

## Supported runtimes

`@flagify/node` works wherever the standard `fetch` API and `AbortController` are available:

- **Node.js** -- any version with `fetch` (Node 18+ natively; Node 16 with a fetch polyfill). No minimum `engines.node` is enforced.
- **Modern browsers** -- evergreen Chromium, Firefox, Safari.
- **Edge runtimes** -- Cloudflare Workers, Vercel Edge, Deno, Bun.
- **React Native (Hermes engine)** -- iOS and Android. The SDK polyfills `AbortSignal.timeout` internally so runtimes that ship `AbortController` without the static `timeout` helper (Hermes, Node < 17.3) still get the 10s request deadline.

This is why `@flagify/react` works on React Native without any extra setup -- it delegates to `@flagify/node`, which handles the runtime gap transparently.

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

    // Real-time updates via SSE — pushes flag changes to the client instantly
    realtime: true,

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
| `options.sseIdleTimeoutMs` | `number` | No | `45000` | Silence watchdog for the realtime stream. If no bytes (including heartbeat comments) arrive within this window, the client aborts and reconnects. Must exceed the server heartbeat interval. |
| `options.sseReconnectBaseMs` | `number` | No | `1000` | Base delay for the SSE reconnection backoff. Actual delay is jittered to 50–100% of the exponential value and honors the server's `retry:` field as a floor. |
| `options.sseReconnectMaxMs` | `number` | No | `30000` | Maximum delay for the SSE reconnection backoff. |
| `options.user` | `FlagifyUser` | No | -- | User context for targeting |

## User context & targeting

Targeting rules let a flag return different values per user (admins, paid plans, beta cohorts, geographies, etc.). The targeting rules themselves are configured server-side in the Flagify dashboard or API — the SDK only forwards the user attributes.

> **Since v1.1.0**, the SDK always runs the targeting engine on every sync — even when you don't pass `options.user`. Catch-all rules (no segment, no conditions) and rollout rules that don't depend on user identity apply to anonymous callers. Segment/condition rules simply don't match when the context is empty, which is the correct behavior for anonymous. You only need to pass `options.user` when you have user-specific targeting.

There are two valid patterns, depending on whether your process serves one user or many.

### Pattern 1 — long-lived single-user client

Useful for CLIs, edge workers, single-tenant background jobs, or React Server Components that build a fresh client per request. Pass the user once via `options.user`; the client will fetch all flag values **already evaluated for that user** at startup. After `await ready()`, `isEnabled()`, `getValue()`, and `getVariant()` return the targeted values straight from the local cache.

```typescript
const flagify = new Flagify({
  projectKey: 'proj_xxx',
  publicKey: 'pk_xxx',
  options: {
    user: { id: 'u_42', role: 'admin', plan: 'enterprise' },
    // For long-lived processes, enable realtime (or set pollIntervalMs) so the
    // cache doesn't go stale after the one-shot startup sync.
    realtime: true,
  },
})

await flagify.ready()
flagify.isEnabled('admin-tools') // true if the targeting rule matches role === 'admin'
```

### Pattern 2 — per-request evaluation (Express, Fastify, Next API routes)

In a typical multi-tenant web server, the client is created once at startup with **no** `options.user`, and you call `await flagify.evaluate(key, user)` per request with the request's user. `evaluate()` calls the API, the server applies the targeting rules, and you get the result back.

Note: even without `options.user`, `isEnabled()` / `getValue()` / `getVariant()` work against the local cache and reflect catch-all and rollout rules (see the note above). Use `flagify.evaluate(key, user)` per request only when you need user-specific targeting (segment membership, conditions, etc.).

```typescript
import express from 'express'
import { Flagify } from '@flagify/node'

const flagify = new Flagify({
  projectKey: 'proj_xxx',
  publicKey: 'pk_xxx',
  options: { realtime: true },
})
await flagify.ready()

const app = express()

app.get('/admin', async (req, res) => {
  // evaluate() makes a network call per request — always wrap in try/catch and
  // pick a safe fallback so an API blip doesn't 500 your handler.
  let allowed = false
  try {
    const result = await flagify.evaluate('admin-tools', {
      id: req.user.id,
      role: req.user.role,
      email: req.user.email,
    })
    allowed = result.value === true
  } catch (err) {
    console.warn('[flagify] evaluate failed, denying access by default', err)
  }

  if (!allowed) return res.status(403).end()
  res.render('admin')
})
```

The user object uses `id` (not `userId`) — the SDK serializes it to `userId` on the wire automatically.

```typescript
{
  id: string                   // required
  email?: string
  role?: string
  group?: string
  geolocation?: { country?: string; region?: string; city?: string }
  [key: string]: unknown       // any custom attribute
}
```

`evaluate()` returns `{ key, value, reason }` where `reason` is one of `targeting_rule`, `rollout`, `default`, or `disabled`. See the [targeting docs](https://flagify.dev/docs/concepts/targeting) for the full list of operators and segment options.

> **Don't mix the patterns in the React SDK.** In `@flagify/react`, the user goes in `<FlagifyProvider options={{ user }}>` once. Do not call `client.evaluate()` from a React hook per flag — it bypasses the cache and produces a flash of the wrong value. See [`@flagify/react` README](../react/README.md#user-context--targeting).

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
| `FLAGIFY_DEBUG` | Set to `1` to enable verbose debug logs (SSE connect/reconnect/sync, flag-change notifications, idle-timeout warnings). Off by default — production consoles stay quiet. Errors that indicate a real problem (failed evaluation, duplicate connect, missing Provider) always log regardless. |

## Debug logging

`@flagify/node` is silent in normal operation. To diagnose connection issues, opt in with the `FLAGIFY_DEBUG` env var:

```bash
FLAGIFY_DEBUG=1 node app.js
```

You'll see entries like:

```
[Flagify] Realtime connected
[Flagify] Synced 12 flags via SSE
[Flagify] Flag changed: new-checkout (updated)
[Flagify] Realtime reconnected
```

Real errors (failed post-sync evaluation, duplicate `connect()` calls, missing configuration) always log with no opt-in needed.

## Verifying webhook signatures

Every Flagify webhook delivery includes an `X-Flagify-Signature: t=<unix>,v1=<hex>` header. The signed string is `<unix>.<rawBody>` with HMAC-SHA256 keyed on the webhook secret you received when the subscription was created.

Two helpers ship in the server-only `@flagify/node/webhooks` subpath:

- `verifyWebhookSignature(rawBody, header, secret, opts?)` — throws on failure, returns `void` on success. Use when you parse the body yourself.
- `constructWebhookEvent(rawBody, header, secret, opts?)` — verifies AND parses the JSON, returns a typed `WebhookEvent`. The convenient default.

> **Why a subpath?** These helpers use `node:crypto`, which does not exist in React Native. Keeping them out of the main entry keeps `@flagify/node` (and therefore `@flagify/react`) bundleable by Metro/Expo. Since v1.6.0 they are **not** exported from the package root — import them from `@flagify/node/webhooks`.

```typescript
import express from "express";
import {
  constructWebhookEvent,
  WebhookSignatureError,
} from "@flagify/node/webhooks";

const app = express();

// Webhook signatures sign the *raw bytes*, so disable JSON parsing for this route.
app.post(
  "/webhooks/flagify",
  express.raw({ type: "application/json" }),
  (req, res) => {
    try {
      const event = constructWebhookEvent(
        req.body, // Buffer — the raw bytes
        req.header("x-flagify-signature") ?? "",
        process.env.FLAGIFY_WEBHOOK_SECRET!,
      );
      // Idempotency: persist event.id and skip duplicates on retry.
      console.log(event.event, event.data.environmentId);
      res.sendStatus(200);
    } catch (err) {
      if (err instanceof WebhookSignatureError) {
        console.error("rejected webhook:", err.code);
        res.sendStatus(403);
        return;
      }
      throw err;
    }
  },
);
```

Both helpers accept an optional `{ tolerance, now }`:

- `tolerance` (seconds, default `300`) — replay-attack window. Set to `0` to disable timestamp checking.
- `now` — override the clock; useful in tests.

`WebhookSignatureError.code` enumerates the failure modes: `MISSING_HEADER`, `MALFORMED_HEADER`, `TIMESTAMP_OUT_OF_TOLERANCE`, `SIGNATURE_MISMATCH`, `INVALID_PAYLOAD`.

## Types

All types are exported for convenience:

```typescript
import type {
  FlagifyOptions,
  FlagifyUser,
  FlagifyFlag,
  IFlagifyClient,
  EvaluateResult,
  FlagChangeEvent,
  RealtimeEvents,
  RealtimeListener,
} from '@flagify/node'

// Webhook types live behind the server-only subpath:
import type {
  WebhookEvent,
  WebhookEventType,
  WebhookEventData,
  VerifyWebhookSignatureOptions,
  WebhookSignatureErrorCode,
} from '@flagify/node/webhooks'
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
