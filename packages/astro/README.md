# @flagify/astro

Official [Flagify](https://flagify.dev) integration for [Astro](https://astro.build). Evaluate feature flags in Astro pages and components with a dev toolbar for overrides.

## Installation

```bash
npm install @flagify/astro @flagify/node
# or
pnpm add @flagify/astro @flagify/node
```

## Setup

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

## Usage

### Define flags

```ts
// src/flags.ts
import { defineFlag } from '@flagify/astro';

export const newCheckout = defineFlag({
  key: 'new-checkout-flow',
  description: 'New checkout flow experience',
  default: false,
});

export const heroVariant = defineFlag({
  key: 'hero-variant',
  description: 'A/B test for hero section',
  default: 'control',
  options: [
    { value: 'control', label: 'Control' },
    { value: 'variant-a', label: 'Variant A' },
  ],
});
```

### Evaluate in pages/components

```astro
---
// src/pages/index.astro
import { newCheckout, heroVariant } from '../flags';

const isNewCheckout = await newCheckout(Astro);
const hero = await heroVariant(Astro);
---

{isNewCheckout && <NewCheckoutBanner />}
<Hero variant={hero} />
```

### Flag evaluation priority

1. **Override cookie** — dev overrides from the toolbar take highest priority
2. **Flagify SDK** — evaluated via `@flagify/node` (cached locally)
3. **Default value** — the `default` from `defineFlag()`

## Dev Toolbar

In development mode, the Flagify toolbar app lets you set flag overrides as JSON. Overrides are stored in a `flagify-overrides` cookie and persist across page navigations.

## Vercel Flags SDK Adapter

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

## SSG Limitations

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

## License

MIT
