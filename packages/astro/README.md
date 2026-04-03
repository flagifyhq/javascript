<p align="center">
  <a href="https://flagify.dev">
    <img alt="Flagify" src="https://flagify.dev/logo-color.svg" width="280" />
  </a>
</p>

<p align="center">
  <strong>Feature flags for modern teams</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@flagify/astro"><img src="https://img.shields.io/npm/v/@flagify/astro.svg?style=flat-square&color=0D80F9" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@flagify/astro"><img src="https://img.shields.io/npm/dm/@flagify/astro.svg?style=flat-square&color=0D80F9" alt="npm downloads" /></a>
  <a href="https://github.com/flagifyhq/javascript/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@flagify/astro.svg?style=flat-square&color=0D80F9" alt="license" /></a>
  <a href="https://github.com/flagifyhq/javascript"><img src="https://img.shields.io/github/stars/flagifyhq/javascript?style=flat-square&color=0D80F9" alt="github stars" /></a>
</p>

<p align="center">
  <a href="https://flagify.dev/docs">Documentation</a> &middot;
  <a href="https://flagify.dev/docs/sdks/astro">SDK Reference</a> &middot;
  <a href="https://github.com/flagifyhq/javascript/issues">Issues</a> &middot;
  <a href="https://flagify.dev">Website</a>
</p>

---

## Overview

`@flagify/astro` is the official Astro integration for [Flagify](https://flagify.dev). Evaluate feature flags in Astro pages and components with a dev toolbar for overrides and a Vercel Flags SDK adapter.

- **Astro-native** -- Integration with auto-injected middleware and dev toolbar
- **`defineFlag` API** -- Declare flags with typed defaults and options
- **Dev toolbar** -- Toggle flag overrides during development via cookie persistence
- **Vercel Flags SDK** -- Built-in adapter via `@flagify/astro/adapter`
- **SSR + SSG** -- Works in both server-rendered and static builds
- **Lightweight** -- Thin wrapper over [`@flagify/node`](https://www.npmjs.com/package/@flagify/node)

## Table of contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Define flags](#define-flags)
- [Evaluate in pages](#evaluate-in-pages)
- [Flag evaluation priority](#flag-evaluation-priority)
- [Dev toolbar](#dev-toolbar)
- [Vercel Flags SDK adapter](#vercel-flags-sdk-adapter)
- [Client management](#client-management)
- [SSG limitations](#ssg-limitations)
- [TypeScript](#typescript)
- [API reference](#api-reference)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
# pnpm
pnpm add @flagify/astro @flagify/node

# npm
npm install @flagify/astro @flagify/node

# yarn
yarn add @flagify/astro @flagify/node
```

> **Peer dependency:** Astro >= 4.0.0

## Quick start

### 1. Add environment variables

```bash
# .env
FLAGIFY_PROJECT_KEY=your-project-key
FLAGIFY_PUBLIC_KEY=pk_dev_xxx
FLAGIFY_SECRET_KEY=sk_dev_xxx  # optional, for SSR evaluation
```

### 2. Add the integration

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import flagify from '@flagify/astro';

export default defineConfig({
  integrations: [flagify()],
});
```

This automatically registers:
- **Middleware** that initializes the Flagify client and parses override cookies
- **Dev toolbar app** for toggling flag overrides during development

### 3. Define and evaluate flags

```ts
// src/flags.ts
import { defineFlag } from '@flagify/astro';

export const newCheckout = defineFlag({
  key: 'new-checkout-flow',
  description: 'New checkout flow experience',
  default: false,
});
```

```astro
---
// src/pages/index.astro
import { newCheckout } from '../flags';

const isNewCheckout = await newCheckout(Astro);
---

{isNewCheckout && <NewCheckoutBanner />}
```

## Define flags

Use `defineFlag` to declare feature flags with typed defaults and optional variant options.

```ts
import { defineFlag } from '@flagify/astro';

// Boolean flag
export const darkMode = defineFlag({
  key: 'dark-mode',
  description: 'Enable dark mode',
  default: false,
});

// String variant with options (used by the dev toolbar)
export const heroVariant = defineFlag({
  key: 'hero-variant',
  description: 'A/B test for hero section',
  default: 'control',
  options: [
    { value: 'control', label: 'Control' },
    { value: 'variant-a', label: 'Variant A' },
  ],
});

// Number flag
export const maxItems = defineFlag({
  key: 'max-items',
  description: 'Maximum items per page',
  default: 20,
});
```

## Evaluate in pages

Each flag defined with `defineFlag` returns an async function that accepts the Astro global.

```astro
---
import { newCheckout, heroVariant, maxItems } from '../flags';

const isNewCheckout = await newCheckout(Astro);
const hero = await heroVariant(Astro);
const max = await maxItems(Astro);
---

{isNewCheckout && <NewCheckoutBanner />}
<Hero variant={hero} />
<ItemList max={max} />
```

## Flag evaluation priority

1. **Override cookie** -- dev overrides from the toolbar take highest priority
2. **Flagify SDK** -- evaluated via `@flagify/node` (cached locally)
3. **Default value** -- the `default` from `defineFlag()`

## Dev toolbar

In development mode, the Flagify toolbar app lets you set flag overrides as JSON. Overrides are stored in a `flagify-overrides` cookie and persist across page navigations.

## Vercel Flags SDK adapter

For projects using the [Vercel Flags SDK](https://flags-sdk.dev):

```ts
import { createFlagifyAdapter } from '@flagify/astro/adapter';

const { adapter } = createFlagifyAdapter();

export const checkout = flag({
  key: 'new-checkout-flow',
  adapter: adapter('new-checkout-flow'),
  defaultValue: false,
});
```

The adapter supports user targeting when entities are passed:

```ts
const { adapter } = createFlagifyAdapter({ origin: 'https://app.flagify.dev' });

export const premium = flag({
  key: 'premium-feature',
  adapter: adapter('premium-feature'),
  defaultValue: false,
});
```

## Client management

The integration manages a singleton `@flagify/node` client. For advanced use cases, you can control it directly:

```ts
import { initClient, getClient, waitForClient, destroyClient } from '@flagify/astro';

// Initialize (no-op if already initialized)
initClient({ projectKey: 'proj_xxx', publicKey: 'pk_xxx' });

// Wait for initial flag sync
await waitForClient();

// Access the client
const client = getClient();
client?.isEnabled('my-flag');

// Cleanup
destroyClient();
```

## SSG limitations

In static builds (SSG), flags are evaluated at **build time** without user context. This works for global flags (kill switches, percentage rollouts) but not for user-targeted flags. For user-targeted evaluation, use SSR mode.

## TypeScript

Add type safety for `context.locals`:

```ts
// src/env.d.ts
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    flagifyOverrides: Record<string, unknown>;
  }
}
```

## API reference

### Main entrypoint (`@flagify/astro`)

| Export | Type | Description |
|--------|------|-------------|
| `default` (flagify) | Function | Astro integration -- registers middleware and dev toolbar |
| `defineFlag` | Function | Define a feature flag with typed defaults |
| `initClient` | Function | Initialize the singleton Flagify client |
| `getClient` | Function | Get the current client instance (or null) |
| `waitForClient` | Function | Wait for initial flag sync to complete |
| `destroyClient` | Function | Destroy the client and free resources |
| `FlagifyAstroOptions` | Type | Integration options (extends `FlagifyOptions`) |
| `FlagDefinition` | Type | Shape of a flag definition |
| `FlagifyLocals` | Type | Shape of `context.locals` set by middleware |
| `FlagEvaluator` | Type | Return type of `defineFlag()` |

### Middleware (`@flagify/astro/middleware`)

| Export | Type | Description |
|--------|------|-------------|
| `onRequest` | Function | Astro middleware -- inits client and parses override cookies |

### Adapter (`@flagify/astro/adapter`)

| Export | Type | Description |
|--------|------|-------------|
| `createFlagifyAdapter` | Function | Creates a Vercel Flags SDK compatible adapter |

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
