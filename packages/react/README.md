<p align="center">
  <a href="https://flagify.dev">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://flagify.dev/logo-white.svg" />
      <source media="(prefers-color-scheme: light)" srcset="https://flagify.dev/logo-color.svg" />
      <img alt="Flagify" src="https://flagify.dev/logo-color.svg" width="280" />
    </picture>
  </a>
</p>

<p align="center">
  <strong>Feature flags for modern teams</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@flagify/react"><img src="https://img.shields.io/npm/v/@flagify/react.svg?style=flat-square&color=0D80F9" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@flagify/react"><img src="https://img.shields.io/npm/dm/@flagify/react.svg?style=flat-square&color=0D80F9" alt="npm downloads" /></a>
  <a href="https://github.com/flagifyhq/react-sdk/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@flagify/react.svg?style=flat-square&color=0D80F9" alt="license" /></a>
  <a href="https://github.com/flagifyhq/react-sdk"><img src="https://img.shields.io/github/stars/flagifyhq/react-sdk?style=flat-square&color=0D80F9" alt="github stars" /></a>
</p>

<p align="center">
  <a href="https://flagify.dev/docs">Documentation</a> &middot;
  <a href="https://flagify.dev/docs/sdks/react">SDK Reference</a> &middot;
  <a href="https://github.com/flagifyhq/react-sdk/issues">Issues</a> &middot;
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
- [Hooks](#hooks)
  - [`useFlag`](#useflagflagkey-string-boolean)
  - [`useVariant`](#usevariantflagkey-string-string--undefined)
  - [`useFlagValue`](#useflagvaluetflagkey-string-t--undefined)
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

## Hooks

### `useFlag(flagKey: string): boolean`

Evaluates a boolean feature flag. Returns `false` if the flag doesn't exist or is disabled.

```tsx
function Dashboard() {
  const isNew = useFlag('new-dashboard')

  if (!isNew) return <LegacyDashboard />
  return <NewDashboard />
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

### `useFlagifyClient(): Flagify`

Direct access to the underlying [`Flagify`](https://github.com/flagifyhq/node-sdk) client instance. Throws if used outside of `<FlagifyProvider>`.

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
| `useFlagifyClient` | Hook | Direct client access |
| `FlagifyProviderProps` | Type | Props for `FlagifyProvider` |
| `FlagifyContextValue` | Type | Shape of the context value |

Types re-exported from `@flagify/node`:

| Export | Description |
|--------|-------------|
| `FlagifyOptions` | Client configuration |
| `FlagifyUser` | User context for targeting |
| `FlagifyFlaggy` | Flag data structure |
| `IFlagifyClient` | Client interface |

## Contributing

We welcome contributions. Please open an issue first to discuss what you'd like to change.

```bash
# Clone
git clone https://github.com/flagifyhq/react-sdk.git
cd react-sdk

# Install
pnpm install

# Development (watch mode)
pnpm run dev

# Build
pnpm run build

# Generate barrel exports
pnpm run generate
```

## License

MIT -- see [LICENSE](./LICENSE) for details.

---

<p align="center">
  <sub>Built with care by the <a href="https://flagify.dev">Flagify</a> team</sub>
</p>
