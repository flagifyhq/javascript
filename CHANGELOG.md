# Changelog

All notable changes to the Flagify JavaScript SDKs will be documented in this file.

## [v1.1.0](https://github.com/flagifyhq/javascript/releases/tag/v1.1.0) — 2026-04-10

### Bug Fixes

- **`@flagify/node`** — the SDK now runs the targeting engine on every sync, even when no `options.user` is configured (#26). Previously, `syncFlags`, `refetchFlag`, and the SSE `onInitialSync` handler skipped the `POST /v1/eval/flags/evaluate` call unless a user was attached, leaving anonymous clients stuck on the raw `value_override ?? default_value` from `GET /v1/eval/flags`. Catch-all and rollout rules were silently ignored for anonymous callers. After the fix, `{ userId: "", attributes: {} }` is sent when no user is configured — the engine treats an empty context as anonymous, catch-all rules match, rollouts bucket deterministically, and segment/condition rules simply don't match (as expected for anonymous).

### Behavior Change (read carefully before upgrading)

- **Flag values may change for anonymous clients.** Any flag that had a catch-all targeting rule or a rollout rule previously returned `defaultValue` for anonymous callers; after upgrade it returns the rule result. If your app depended on the buggy value, audit your targeting rules before rolling out 1.1.0.
- **Every sync now makes two HTTP calls instead of one** (`GET /v1/eval/flags` + `POST /v1/eval/flags/evaluate`). This doubles the eval counter on your billing meter per init / refetch / poll / SSE initial sync. Heavy users on tight plans may see a spike. A server-side consolidation is tracked in the monorepo as a medium-priority follow-up.
- **No API changes.** `isEnabled`, `getValue`, `getVariant`, `evaluate`, `ready`, `destroy`, and the React hooks all have identical signatures. No code changes are required to upgrade — only the returned values may differ.

### Documentation

- Package READMEs and website docs now clarify that catch-all and rollout rules apply to anonymous callers as well, and removed stale claims that implied user context was required for targeting.

## [v1.0.7](https://github.com/flagifyhq/javascript/releases/tag/v1.0.7) — 2026-04-10

### Documentation

- Add "User context & targeting" section to `@flagify/node` and `@flagify/react` READMEs explaining the one-shot pattern (pass `options.user` once, SDK returns values already evaluated) (#24)
- Fix `useFlag` return type documentation, inline Provider wrapper example, guard `evaluate()` example (#25)

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
