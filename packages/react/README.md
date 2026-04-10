<p align="center">
  <a href="https://flagify.dev">
    <img alt="Flagify" src="https://flagify.dev/logo-color.svg" width="280" />
  </a>
</p>

<p align="center">
  <strong>Feature flags for modern teams</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@flagify/react"><img src="https://img.shields.io/npm/v/@flagify/react.svg?style=flat-square&color=0D80F9" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@flagify/react"><img src="https://img.shields.io/npm/dm/@flagify/react.svg?style=flat-square&color=0D80F9" alt="npm downloads" /></a>
  <a href="https://github.com/flagifyhq/javascript/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@flagify/react.svg?style=flat-square&color=0D80F9" alt="license" /></a>
  <a href="https://github.com/flagifyhq/javascript"><img src="https://img.shields.io/github/stars/flagifyhq/javascript?style=flat-square&color=0D80F9" alt="github stars" /></a>
</p>

<p align="center">
  <a href="https://flagify.dev/docs">Documentation</a> &middot;
  <a href="https://flagify.dev/docs/sdks/react">SDK Reference</a> &middot;
  <a href="https://github.com/flagifyhq/javascript/issues">Issues</a> &middot;
  <a href="https://flagify.dev">Website</a>
</p>

---

## Overview

`@flagify/react` is the official React SDK for [Flagify](https://flagify.dev). Idiomatic hooks and a context provider for feature flag evaluation in React applications.

- **Hooks-first** -- `useFlag`, `useVariant`, `useFlagValue` for every use case
- **Type-safe** -- Full TypeScript generics for flag values
- **Zero config** -- Wrap with `<FlagifyProvider>`, use hooks anywhere
- **Lightweight** -- Thin wrapper over [`@flagify/node`](https://github.com/flagifyhq/node-sdk)
- **React 18+** -- Built for modern React
- **React Native ready** -- Works in React Native and Expo with zero additional setup

## Table of contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Provider](#provider)
- [User context & targeting](#user-context--targeting)
- [Hooks](#hooks)
  - [`useFlag`](#useflagflagkey-string-boolean--undefined)
  - [`useVariant`](#usevariantflagkey-string-string--undefined)
  - [`useFlagValue`](#useflagvaluetflagkey-string-t--undefined)
  - [`useIsReady`](#useisready-boolean)
  - [`useFlagifyClient`](#useflagifyclient-flagify)
- [Examples](#examples)
- [API reference](#api-reference)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
# pnpm
pnpm add @flagify/react

# npm
npm install @flagify/react

# yarn
yarn add @flagify/react
```

> **Peer dependency:** React 18+ is required.

## React Native / Expo

`@flagify/react` is fully compatible with React Native (0.64+) and Expo (SDK 44+). No separate package or polyfills needed.

```bash
npx expo install @flagify/react
```

Wrap your root with `<FlagifyProvider>` and use hooks anywhere. For a full getting-started guide, see the [React Native documentation](https://flagify.dev/docs/sdks/react-native).

## Quick start

**1. Wrap your app with the provider**

```tsx
import { FlagifyProvider } from '@flagify/react'

function App() {
  return (
    <FlagifyProvider projectKey="proj_xxx" publicKey="pk_xxx">
      <YourApp />
    </FlagifyProvider>
  )
}
```

**2. Use hooks in any component**

```tsx
import { useFlag } from '@flagify/react'

function Navbar() {
  const showBanner = useFlag('promo-banner')

  return (
    <nav>
      {showBanner && <PromoBanner />}
    </nav>
  )
}
```

## Provider

### `<FlagifyProvider>`

Initializes the Flagify client and provides it to all child components via React context.

```tsx
<FlagifyProvider
  projectKey="proj_xxx"
  publicKey="pk_xxx"
  options={{
    apiUrl: 'https://api.flagify.dev',
    staleTimeMs: 300_000,
    user: {
      id: 'user_123',
      email: 'mario@example.com',
      role: 'admin',
      geolocation: { country: 'US' },
    },
  }}
>
  {children}
</FlagifyProvider>
```

#### Props

All props from [`FlagifyOptions`](https://github.com/flagifyhq/node-sdk#configuration-options) are supported:

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `projectKey` | `string` | Yes | Project identifier from your Flagify workspace |
| `publicKey` | `string` | Yes | Client-safe publishable API key |
| `secretKey` | `string` | No | Server-side secret key |
| `options` | `object` | No | Additional configuration (apiUrl, staleTimeMs, user, realtime) |
| `children` | `ReactNode` | Yes | Your application tree |

#### Context value

The provider exposes the following context:

| Property | Type | Description |
|----------|------|-------------|
| `client` | `Flagify \| null` | The underlying Flagify client instance |
| `isReady` | `boolean` | `true` once the client has been initialized |

## User context & targeting

Targeting rules let a flag return different values per user — for example, an `admin-tools` flag that's only `true` for users whose `role === 'admin'`, or a `beta-features` flag enabled for `plan === 'enterprise'`. **The targeting rules themselves are configured server-side** in the Flagify dashboard or API. The React SDK only forwards the user attributes.

> **Since v1.1.0**, the Provider always asks the targeting engine on init — even when `options.user` is `undefined`. Catch-all rules and rollout rules that don't depend on user identity apply to anonymous visitors, so `useFlag('promo-banner')` reflects the rule result from the very first render (after `isReady`), not the raw `defaultValue`. You only need to pass `options.user` when you have rules that actually discriminate by user attributes.

The pattern is one-shot, **not** per-flag:

1. After the user is loaded by your auth layer, mount `<FlagifyProvider>` with `options.user`.
2. The Provider's underlying client fetches all flag values **already evaluated against the targeting rules for that user** and stores them in its local cache.
3. `useFlag('admin-tools')` reads the cached, already-targeted value and re-renders when it changes via SSE.

There is no second hook, no `useFlag(key, user)` overload, and no need to call `client.evaluate()` from a component. **Do not** wrap `useFlag` in a custom hook that calls `client.evaluate(key, user)` per flag — it bypasses the cache, is async, and produces a flash of the wrong value.

```tsx
import { FlagifyProvider, useFlag } from '@flagify/react'
import { useCurrentUser } from './auth'

function Root() {
  const user = useCurrentUser() // your app's auth state

  return (
    <FlagifyProvider
      // key forces a fresh client + resync when the user changes (login/logout)
      key={user?.id ?? 'anonymous'}
      projectKey="proj_xxx"
      publicKey="pk_xxx"
      options={{
        realtime: true,
        user: user
          ? { id: user.id, role: user.role, email: user.email }
          : undefined,
      }}
    >
      <App />
    </FlagifyProvider>
  )
}

function AdminMenu() {
  // Already evaluated against targeting rules for the current user.
  // useFlag returns `undefined` until the initial sync completes, so compare
  // explicitly — don't assume truthiness.
  const canSeeAdmin = useFlag('admin-tools')
  if (canSeeAdmin !== true) return null
  return <Admin />
}
```

### Where to mount the Provider

`<FlagifyProvider>` must be **below** the provider that loads your user, so the user is available when the Flagify client initializes. If the Provider mounts before the user is known, the cache is populated with the **anonymous** evaluations — catch-all / rollout rules still apply correctly, but any rule that targets by user attributes will miss until the Provider remounts with the real user (use `key={user?.id ?? 'anonymous'}` to force that resync on login/logout).

The simplest pattern is a thin wrapper that reads the user from your auth context and forwards it to `<FlagifyProvider>`:

```tsx
import { FlagifyProvider } from '@flagify/react'
import { useCurrentUser } from './auth'

function AppFlagifyProvider({ children }: { children: React.ReactNode }) {
  const user = useCurrentUser()

  return (
    <FlagifyProvider
      key={user?.id ?? 'anonymous'}
      projectKey="proj_xxx"
      publicKey="pk_xxx"
      options={{
        realtime: true,
        user: user
          ? { id: user.id, role: user.role, email: user.email }
          : undefined,
      }}
    >
      {children}
    </FlagifyProvider>
  )
}

function Root() {
  return (
    <AuthProvider>
      <AppFlagifyProvider>
        <ReactQueryProvider>
          <Router>{/* the rest of your app */}</Router>
        </ReactQueryProvider>
      </AppFlagifyProvider>
    </AuthProvider>
  )
}
```

### User object shape

```typescript
{
  id: string                   // required — the user identifier (NOT "userId")
  email?: string
  role?: string
  group?: string
  geolocation?: { country?: string; region?: string; city?: string }
  [key: string]: unknown       // any custom attribute (plan, companySize, betaCohort, etc.)
}
```

The field is `id`, not `userId`. The SDK serializes it to `userId` on the wire automatically.

### When the user changes

The Provider re-syncs flags when `options.user.id` changes. The simplest way to make this fully reliable across all user attributes (and to invalidate any other client state tied to the previous identity) is to remount the Provider with `key={user.id ?? 'anonymous'}`. Switching from `'anonymous'` to a real id, or between two real ids, will tear down the old client and create a fresh one with the new user, refetching evaluated flags.

For server-side per-request evaluation (e.g. inside Next.js API routes or Express handlers), use `flagify.evaluate(key, user)` from `@flagify/node` directly — see the [`@flagify/node` README](https://github.com/flagifyhq/javascript/tree/main/packages/node#flagifyevaluateflagkey-string-user-flagifyuser-promiseevaluateresult).

## Hooks

### `useFlag(flagKey: string): boolean | undefined`

Evaluates a boolean feature flag. Returns `undefined` while the client is still syncing (`isReady === false`), then `true`/`false` once the cache is populated. Returns `false` for missing or disabled flags.

Because the first render can be `undefined`, gate on an explicit comparison (or use [`useIsReady`](#useisready-boolean)) instead of relying on truthiness — especially for flags whose "off" state is visible UI.

```tsx
function Dashboard() {
  const isNew = useFlag('new-dashboard')

  // Wait for sync before deciding — avoids a flash of the legacy dashboard.
  if (isNew === undefined) return <Spinner />
  return isNew ? <NewDashboard /> : <LegacyDashboard />
}
```

---

### `useVariant(flagKey: string): string | undefined`

Returns the string variant of a multivariate flag. Ideal for A/B tests and experiments.

```tsx
function Onboarding() {
  const variant = useVariant('onboarding-flow')

  switch (variant) {
    case 'control':   return <OnboardingClassic />
    case 'variant-a': return <OnboardingShort />
    case 'variant-b': return <OnboardingGuided />
    default:          return <OnboardingClassic />
  }
}
```

---

### `useFlagValue<T>(flagKey: string): T | undefined`

Returns a typed flag value with full TypeScript generics. Supports `number`, `string`, `boolean`, and `JSON` values.

```tsx
interface ListConfig {
  maxItems: number
  showPagination: boolean
}

function ItemList() {
  const config = useFlagValue<ListConfig>('list-config')

  return (
    <ul>
      {items.slice(0, config?.maxItems ?? 10).map(item => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  )
}
```

---

### `useIsReady(): boolean`

Returns `true` once the Flagify client has completed its initial flag sync. Useful for showing loading states.

```tsx
function App() {
  const isReady = useIsReady()

  if (!isReady) return <Spinner />
  return <Dashboard />
}
```

---

### `useFlagifyClient(): Flagify`

Direct access to the underlying [`Flagify`](https://www.npmjs.com/package/@flagify/node) client instance. Throws if used outside of `<FlagifyProvider>`.

```tsx
function FeatureGate({ flagKey, children }: { flagKey: string; children: ReactNode }) {
  const client = useFlagifyClient()

  if (!client.isEnabled(flagKey)) return null
  return <>{children}</>
}
```

## Examples

### Feature gate component

```tsx
import { useFlag } from '@flagify/react'
import type { ReactNode } from 'react'

function FeatureGate({ flag, children, fallback }: {
  flag: string
  children: ReactNode
  fallback?: ReactNode
}) {
  const isEnabled = useFlag(flag)
  return <>{isEnabled ? children : fallback}</>
}

// Usage
<FeatureGate flag="premium-features" fallback={<UpgradePrompt />}>
  <PremiumDashboard />
</FeatureGate>
```

### A/B test with analytics

```tsx
import { useVariant } from '@flagify/react'
import { useEffect } from 'react'

function PricingPage() {
  const variant = useVariant('pricing-layout')

  useEffect(() => {
    analytics.track('pricing_viewed', { variant })
  }, [variant])

  return variant === 'variant-a'
    ? <PricingCards />
    : <PricingTable />
}
```

### Remote config

```tsx
import { useFlagValue } from '@flagify/react'

interface ThemeConfig {
  primaryColor: string
  borderRadius: number
  fontFamily: string
}

function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useFlagValue<ThemeConfig>('theme-config')

  const style = {
    '--primary': theme?.primaryColor ?? '#0D80F9',
    '--radius': `${theme?.borderRadius ?? 8}px`,
    '--font': theme?.fontFamily ?? 'Inter',
  } as React.CSSProperties

  return <div style={style}>{children}</div>
}
```

## API reference

| Export | Type | Description |
|--------|------|-------------|
| `FlagifyProvider` | Component | Context provider -- wraps your app |
| `FlagifyContext` | `React.Context` | Raw context (advanced usage) |
| `useFlag` | Hook | Boolean flag evaluation |
| `useVariant` | Hook | String variant evaluation |
| `useFlagValue` | Hook | Typed value evaluation with generics |
| `useIsReady` | Hook | Client readiness check |
| `useFlagifyClient` | Hook | Direct client access |
| `FlagifyProviderProps` | Type | Props for `FlagifyProvider` |
| `FlagifyContextValue` | Type | Shape of the context value |

Types re-exported from `@flagify/node`:

| Export | Description |
|--------|-------------|
| `FlagifyOptions` | Client configuration |
| `FlagifyUser` | User context for targeting |
| `FlagifyFlag` | Flag data structure |
| `IFlagifyClient` | Client interface |

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
