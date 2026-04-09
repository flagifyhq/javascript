# Changelog

All notable changes to the Flagify JavaScript SDKs will be documented in this file.

## [v1.0.6](https://github.com/flagifyhq/javascript/releases/tag/v1.0.6) — 2026-04-09

### Bug Fixes

- Improve error handling with typed auth errors and stricter config validation (`@flagify/node`, `@flagify/react`)

## [v1.0.5](https://github.com/flagifyhq/javascript/releases/tag/v1.0.5) — 2026-04-07

Sync version with CLI release (no code changes).

## [v1.0.4](https://github.com/flagifyhq/javascript/releases/tag/v1.0.4) — 2026-04-07

### Bug Fixes

- Handle unhandled promise rejection and reset SSE connection state (#21)
- Resolve medium-severity issues across node and react SDKs (#20)
- Resolve critical and high-severity SDK issues (#19)
- Deduplicate concurrent refetch calls to prevent race conditions
- Throw on missing config keys instead of silent failure
- Send `secretKey` as `x-secret-key` header when provided
- Deterministic variant distribution via FNV-1a hash
- Freeze HTTP client headers to prevent API key mutation
- Multiline SSE data field support per spec
- React hooks return `undefined` before client ready (prevent flash)
- NestJS typed constant key instead of untyped `any` cast
- Astro middleware single-init, skip env reads on subsequent requests
- Cookie overrides restricted to dev environment only
- Catch `evaluateWithUser` promise in `onInitialSync`
- Reset `hasConnectedBefore` on SSE disconnect

### Improvements

- Rename `FlagifyFlaggy` → `FlagifyFlag`
- Event emitter pattern (`onFlagChange` with unsubscribe)
- Send `projectKey` as `x-project-key` header
- React hooks use `useMemo` instead of void version hack
- 10s fetch timeout via `AbortSignal.timeout`
- Retry with backoff on initial `syncFlags`
- `FlagifyProvider` recreates client on option changes

## [v1.0.3](https://github.com/flagifyhq/javascript/releases/tag/v1.0.3) — 2026-04-05

### Bug Fixes

- Graceful degradation + SSE initial sync (#18)

## [v1.0.2](https://github.com/flagifyhq/javascript/releases/tag/v1.0.2) — 2026-04-03

### Features

- Add `matchType` and `rolloutSalt` fields to targeting rule types (#16)

### Docs

- Add NestJS and Astro packages to root README (#17)

## [v1.0.1](https://github.com/flagifyhq/javascript/releases/tag/v1.0.1) — 2026-04-03

### Docs

- Unify README across all SDK packages (#15)

## [v1.0.0](https://github.com/flagifyhq/javascript/releases/tag/v1.0.0) — 2026-04-03

Initial release of the Flagify JavaScript SDKs.

### Packages

- `@flagify/node` — Server-side SDK
- `@flagify/react` — React SDK with hooks and provider
- `@flagify/nestjs` — NestJS module
- `@flagify/astro` — Astro integration
