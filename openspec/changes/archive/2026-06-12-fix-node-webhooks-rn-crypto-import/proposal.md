# Fix: `@flagify/node@1.5.0` top-level `crypto` import breaks React Native / Expo bundles

## Why

`@flagify/node@1.5.0` (PR #41) added webhook signature verification with a top-level `import { createHmac, timingSafeEqual } from "crypto"` in `packages/node/src/webhooks/verify.ts`, and the barrelsby-generated barrel re-exports it from the main entry. Metro does not tree-shake module imports, so every React Native / Expo app that imports `@flagify/react@1.5.0` fails at build time (`attempted to import the Node standard library module "crypto"`) — a P1 regression with silent blast radius via `^1.x` lockfile reinstalls. Versions ≤ 1.4.0 are unaffected; the webhook feature is inherently server-only.

## What Changes

- **BREAKING** Remove all `webhooks/*` re-exports from the main entry of `@flagify/node` (`src/index.ts` barrel + barrelsby config so regeneration keeps them excluded).
- Add a dedicated subpath export `@flagify/node/webhooks` (new tsup entry `src/webhooks.ts` → `dist/webhooks.{mjs,js,d.ts}`, new `"./webhooks"` condition in `package.json#exports` with `types`/`import`/`require`).
- Switch the crypto import to the explicit `node:crypto` prefix.
- Add a CI bundling guard: a neutral-platform bundle (esbuild, Node builtins disallowed) of a fixture importing `@flagify/react` must succeed, and the main-entry graph must contain zero Node builtins (`crypto`, `fs`, `path`, …). Also surfaces the latent `dotenv` risk.
- Release **1.6.0** via the `flagify-release` flow with a CHANGELOG migration note; after publish, `npm deprecate @flagify/node@1.5.0` and `@flagify/react@1.5.0`.
- Docs sync: website webhooks docs (`apps/apps/website/src/content/docs/`) and `packages/node/README.md` import from `@flagify/node/webhooks`; decision log entry in `Flagify Docs/decisions/`.

**Non-goals:** Option B (lazy `crypto` resolution at call time — API would appear available on RN and fail at runtime; lazy require in pure ESM is fragile); backward compatibility for root imports of webhook helpers in 1.5.0 (days-old release, minimal blast radius); changes to webhook verification logic or API-side delivery; reverting the downstream Metro shim in `vanguardhq/apps/app` (follow-up after release, outside this repo).

## Capabilities

### New Capabilities

- `node-package-entrypoints`: Entry-point contract for `@flagify/node` — the main entry (`.`) SHALL be platform-neutral (no Node builtin imports, bundleable by Metro/neutral bundlers), server-only webhook helpers SHALL be exposed exclusively via the `./webhooks` subpath export (ESM + CJS + types), and CI SHALL fail if any Node builtin enters the main-entry graph.

### Modified Capabilities

<!-- none — `node-http-client` requirements are untouched -->

## Impact

- **Code:** `javascript/packages/node/src/index.ts`, `src/webhooks/verify.ts`, new `src/webhooks.ts`, barrelsby config, tsup config, `package.json` (`exports`, `files`), new CI bundling test + fixture.
- **Consumers (breaking):** anyone importing `verifyWebhookSignature` / webhook construct helpers from the package root in 1.5.0 must switch to `@flagify/node/webhooks` (migration note in CHANGELOG for 1.6.0).
- **Consumers (fixed):** all React Native / Expo apps using `@flagify/react` — bundling works again without Metro shims.
- **Release/registry:** versions 1.6.0 published for `@flagify/node` and `@flagify/react`; 1.5.0 of both deprecated on npm.
- **Docs:** website webhooks section, `packages/node/README.md`, CHANGELOG, decision log (`Flagify Docs/decisions/2026-06-XX-node-webhooks-subpath-export.md` + index).
- **Open questions:** does the CI guard immediately flag `dotenv` (`fs`/`path`), forcing its isolation into this same release? Should the rule "server-only additions go behind subpath exports from day 1" be recorded as policy in CLAUDE.md/contributing docs?
