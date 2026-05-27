# Changelog

All notable changes to the Flagify JavaScript SDKs will be documented in this file.

## [v1.5.0](https://github.com/flagifyhq/javascript/releases/tag/v1.5.0) — 2026-05-26

### Bug Fixes

- **`@flagify/node`** — SSE reconnection backoff no longer resets on every successful connect ([#43](https://github.com/flagifyhq/javascript/pull/43)). Previously, `reconnectAttempts` was reset to `0` the instant the SSE stream responded `200`, so a server that dropped the connection right after `initial_sync` caused a tight ~1s reconnect loop that never backed off — flooding logs and wasting bandwidth. The fix introduces a 5-second grace period (`HEALTHY_CONNECTION_GRACE_MS`): the backoff counter only resets after the stream has survived that long. Connections that die sooner now grow the backoff exponentially (1s → 2s → 4s → … → 30s cap) instead of looping at the floor.
- **`@flagify/node`** — polyfill `AbortSignal.timeout` for runtimes that ship `AbortController` without the static `timeout` helper ([#42](https://github.com/flagifyhq/javascript/pull/42)). React Native (Hermes engine, iOS + Android) and Node.js `<17.3` were throwing `TypeError: AbortSignal.timeout is not a function` the first time the HTTP client tried to enforce a request deadline, breaking `flagify.ready()` and any subsequent fetch. The fix wraps the lookup in a feature detect and falls back to a `new AbortController()` + `setTimeout(controller.abort, ms)` shim — same observable behavior (10s request timeout aborts with `AbortError`), zero new dependencies, no `engines.node` floor introduced. `@flagify/react` is unaffected directly but inherits the fix via `@flagify/node` and now works out of the box in React Native / Expo without the user installing a polyfill. Decision: `Flagify Docs/decisions/2026-05-14-abortsignal-timeout-runtime-compat.md`.

### Features

- **`@flagify/node`** — new `verifyWebhookSignature(rawBody, header, secret, opts?)` and `constructWebhookEvent(rawBody, header, secret, opts?)` helpers for receivers of Flagify webhook deliveries. Both accept the raw bytes plus the `X-Flagify-Signature: t=<unix>,v1=<hex>` header; they validate the HMAC-SHA256 of `<unix>.<rawBody>` against the webhook secret you received at subscription create time, and (for `constructWebhookEvent`) parse the JSON into a typed `WebhookEvent`. Failures throw `WebhookSignatureError` with a machine-readable `code` (`MISSING_HEADER`, `MALFORMED_HEADER`, `TIMESTAMP_OUT_OF_TOLERANCE`, `SIGNATURE_MISMATCH`, `INVALID_PAYLOAD`). Replay-attack window defaults to `300s` (configurable via `tolerance`).
- **`@flagify/nestjs`** — re-exports the helpers and adds `FlagifyWebhookGuard` for declarative use in controllers. The guard reads the raw body (`request.rawBody` by default; configurable via `rawBodyAccessor`), validates the header, and stores the parsed event on `request.flagifyEvent` for the handler. Supports both static `secret` and per-request `resolveSecret(req)` strategies for multi-webhook setups.
- **`@flagify/astro`** — re-exports the helpers and adds `defineWebhookHandler({ secret, onEvent, verify? })`, an Astro `APIRoute` factory that returns 200/403/500 based on signature validity and handler outcome. Reads the body via `request.text()`, so works in any SSR adapter (Node, Vercel, Cloudflare Workers).
- **8 supported event types** are exported as a discriminated union (`WebhookEventType`): `flag.created`, `flag.updated`, `flag.archived`, `flag.cloned`, `flag.toggled`, `flag.variants_set`, `flag.promoted`, `targeting.rules_set` — kept in lockstep with the API's `internal/domain/webhook/model.go::SupportedEvents()`.

### Documentation

- **`@flagify/node` README** — new "Verifying webhook signatures" section with an Express raw-body example and an enumeration of `WebhookSignatureError` codes.
- **`@flagify/nestjs` README** — new section covering `FlagifyWebhookGuard` plus the `request.rawBody` setup that is required for signature verification (`express.json({ verify })`).
- **`@flagify/astro` README** — new section showing `defineWebhookHandler` in an SSR API route.
- **Website** docs — `concepts/webhooks.mdx` adds a "Verifying signatures in your code" block with examples for Node, NestJS, and Astro; the SDK pages link to the new sections (companion PR in `flagifyhq/apps`).

### Notes

- **Server-only.** `@flagify/react` does **not** ship signature helpers — webhooks are server-to-server. Browser code never receives them.
- **Raw bytes required.** Frameworks that JSON-parse the body before your handler runs (Express's default `json()`, NestJS, …) mutate the bytes that the API signed over. Read the raw stream (e.g. `express.raw({ type: 'application/json' })` or `express.json({ verify: (req, _res, buf) => req.rawBody = buf })`) before calling the helpers.
- **Idempotency.** Each delivery includes a stable `event.id` (ULID). Persist it on the receiver side and skip duplicates — the API may retry deliveries after transient failures.

## [v1.4.0](https://github.com/flagifyhq/javascript/releases/tag/v1.4.0) — 2026-05-02

### Features

- **`@flagify/node`** — verbose SSE logs (connect / reconnect / sync / flag-change notifications / idle-timeout warnings) are now gated behind an opt-in `FLAGIFY_DEBUG` env var ([#39](https://github.com/flagifyhq/javascript/pull/39)). Production consoles stay quiet by default — the previous always-on `console.info`/`debug`/`warn` lines emitted on every SSE connect, reconnect, initial sync, flag change, and idle timeout were noisy in every consumer app. Activates with `FLAGIFY_DEBUG=1` (Node + bundlers that inline `process.env`) or `localStorage.FLAGIFY_DEBUG = "1"` for browser-only builds without env-var inlining (Next.js without `NEXT_PUBLIC_` prefix, Vite without `VITE_*` prefix, etc.). Real errors that indicate a real problem (failed post-sync evaluation, duplicate `connect()` call, missing `<FlagifyProvider>`) are **not** gated and continue to log so devs are not surprised by silent failures. Decision: `Flagify Docs/decisions/2026-04-30-flagify-debug-env-var.md`.
- **`@flagify/react`** — same opt-in applies via the underlying `@flagify/node` client. Browser bundles read `localStorage.FLAGIFY_DEBUG`; documentation calls out the `NEXT_PUBLIC_` / `VITE_*` inlining caveat so users do not assume `process.env.FLAGIFY_DEBUG` reaches the browser.
- **`@flagify/nestjs`**, **`@flagify/astro`** — wrappers around `@flagify/node`; the same `FLAGIFY_DEBUG=1` env var enables verbose logs in NestJS apps (`FLAGIFY_DEBUG=1 nest start`) and Astro projects (`FLAGIFY_DEBUG=1 astro dev`). Off by default.

### Behavior Change (read carefully before upgrading)

- **The verbose SSE logs that used to appear by default no longer appear by default.** If your tooling (log aggregation, alerting, debugging scripts) parses for strings like `[Flagify] Realtime connected`, `[Flagify] Synced N flags via SSE`, or `[Flagify] Flag changed: <key>`, those lines now require `FLAGIFY_DEBUG=1`. Errors continue to log unconditionally. No API changes — `isEnabled`, `getValue`, `getVariant`, `evaluate`, `ready`, `destroy`, and the React hooks all keep identical signatures. The `debug.ts` helper itself is internal (excluded from the public barrel) so renaming or removing `debugLog` / `debugEnabled` will not break consumers.

### Documentation

- **`@flagify/node` README** — new "Debug logging (`FLAGIFY_DEBUG`)" section + entry in the configuration env-var table.
- **`@flagify/react` README** — new "Debugging the realtime connection" section that documents both the `FLAGIFY_DEBUG=1` env-var path (works under bundlers that inline `process.env`) and the `localStorage.FLAGIFY_DEBUG = "1"` path (browser fallback).
- **`@flagify/nestjs` README** and **`@flagify/astro` README** — short notes pointing to the same env var since both wrap `@flagify/node`.
- **Website** SDK docs at `apps/website/src/content/docs/v1/sdk/javascript.mdx` and `react.mdx` document the env var and the bundler-prefix caveat ([flagifyhq/apps#166](https://github.com/flagifyhq/apps/pull/166)). `nestjs.mdx` includes the same note; `astro.mdx` is updated in this release.
- **Heartbeat interval** clarified: the server emits an SSE heartbeat every **15s**; the client `sseIdleTimeoutMs` watchdog defaults to **45s** (3 missed heartbeats) before forcing a reconnect. Both numbers now appear consistently across `@flagify/node` README, `javascript.mdx`, and `react.mdx`.

## [v1.3.0](https://github.com/flagifyhq/javascript/releases/tag/v1.3.0) — 2026-04-14

### Bug Fixes

- **`@flagify/node`** — SSE realtime connection now works in browsers ([#36](https://github.com/flagifyhq/javascript/pull/36)). The SDK was sending `Cache-Control: no-cache` and `Pragma: no-cache` on the `fetch()` to `/v1/eval/flags/stream`. Neither is a CORS-simple header, so browsers dispatched a preflight listing them, and the API's `PublicCORS` allowlist did not include them — the preflight failed, the browser blocked the connection, and `options.realtime: true` silently fell back to polling (or never streamed at all) in the browser. Both headers are redundant for SSE (`text/event-stream` is not cached by browsers), so they were removed from the request. Node-side clients were never affected because Node's `fetch` does not perform CORS checks. Reported by an external user integrating `@flagify/react` in Next.js.

### Breaking Type Change (compile-time only, read carefully before upgrading)

- **`@flagify/react`** — `FlagifyProviderProps` no longer exposes the `secretKey` field ([#37](https://github.com/flagifyhq/javascript/pull/37)). The React Provider's props type now extends `Omit<FlagifyOptions, 'secretKey'>` instead of the full `FlagifyOptions`. Secret keys (`sk_*`) are server-only and must never ship to a browser bundle; having the field in the Provider's public type invited developers to paste one in. **Who breaks:** TypeScript users who were passing `secretKey` to `<FlagifyProvider>` (or `<FlagifyAuthProvider>`) will get a compile error after upgrading. **What to do:** remove the `secretKey` prop — it was being ignored at runtime by any correctly configured browser bundle and its presence was actively dangerous. Plain JavaScript users and anyone using only `publicKey` are unaffected. Runtime behavior is unchanged for correct usage; if a `sk_*` key slips through via `as any` or a `publicKey="sk_..."` typo, the Provider now logs a hard `console.error` in the browser instead of silently forwarding the secret.

### Improvements

- **`@flagify/react`** — new runtime guard in `<FlagifyProvider>` that detects secret-key leakage to the browser. Triggers on either a `secretKey` passed via type-escape (`as any`) or a `publicKey` whose value starts with `sk_`. Logs a `console.error` with remediation guidance. The guard is a browser-only check (gated on `typeof window !== 'undefined'`) and does not affect SSR or Node consumers.

### Documentation

- `@flagify/react` README updated to stop listing `secretKey` as a Provider prop and to call out that secret keys belong in server SDKs only (`@flagify/node`, `@flagify/nestjs`, `@flagify/astro` middleware).
- Website SDK docs at `apps/website/src/content/docs/v1/sdk/react.mdx` mirror the Provider prop change.

## [v1.2.0](https://github.com/flagifyhq/javascript/releases/tag/v1.2.0) — 2026-04-11

### Features

- **`@flagify/react`** — new `<FlagifyAuthProvider>` wrapper component (#29). Thin wrapper around `<FlagifyProvider>` that takes a `useUserHook` prop so the wrapper can sit **below** another React provider (React Query, Zustand, Redux, any context-based auth layer) without the chicken-and-egg ordering trap. The wrapper calls your hook on every render, forwards the returned user to `options.user`, and computes a stable remount key from the full user object — so impersonation, in-session role/plan upgrades, and custom-attribute changes all force a clean resync, not just `user.id` changes. Pass a custom `userKey` prop to narrow the fingerprint (e.g. id-only) for cheaper re-evaluation. Closes frictions 2.1, 2.3, and 2.5 from `USAGE_PROD_FEEDBACK.md`.
- **`@flagify/node`** — SSE realtime listener gains a silence watchdog and configurable reconnect backoff (#30). Three new optional fields on `FlagifyOptions.options`:
  - `sseIdleTimeoutMs` (default `45000`) — if no bytes arrive in this window, abort and reconnect. Catches zombie TCP connections where the socket stays open but no data flows. Must exceed the server heartbeat interval.
  - `sseReconnectBaseMs` (default `1000`) — base delay for the exponential backoff.
  - `sseReconnectMaxMs` (default `30000`) — cap for the exponential backoff.

  Backoff is now jittered to 50–100% of the exponential value to avoid thundering-herd reconnects when a fleet of clients reconnects simultaneously. The server's SSE `retry:` field acts as a floor when present and is cleared on every successful reconnect (pragmatic deviation from strict WHATWG SSE semantics — a one-shot `retry:` will not pin the backoff forever).

### Behavior Change (read carefully before upgrading)

- **SSE reconnection is now watchdog-driven for every `@flagify/node` client with `options.realtime: true`.** Existing code that does not set the new `sseIdleTimeoutMs` / `sseReconnectBaseMs` / `sseReconnectMaxMs` options gets the new behavior automatically — the 45-second idle timeout and jittered reconnect backoff replace the previous pure exponential with no silence detection. This is a strict improvement for long-running processes on flaky networks (connections that would previously go zombie are now recovered), but the timing of reconnects changes: retries happen sooner after a silent drop and are jittered to avoid thundering-herd bursts. If your infra has alerting keyed on deterministic reconnect timing, audit before upgrading. The `onInitialSync` handler continues to call `evaluateWithUser()` on every reconnect — per-user evaluated flag values remain correct after the new watchdog-triggered reconnects.
- **No API changes.** `isEnabled`, `getValue`, `getVariant`, `evaluate`, `ready`, `destroy`, and the existing React hooks all have identical signatures. `<FlagifyAuthProvider>` is a new additive component — existing `<FlagifyProvider>` usage continues to work unchanged.

### Improvements

- **`@flagify/node`** — `RealtimeListener` gains a `destroyed` flag that prevents resurrect-after-destroy race conditions. Previously, a queued watchdog callback could schedule a new reconnect timer after `client.destroy()` returned, leaking timers and resurrecting a supposedly-dead listener. The `isStreaming` state transition is now owned by a single `finally` block in `stream()` instead of scattered across happy/catch/aborted paths. The reader loop checks `destroyed` at the top of every iteration so frame dispatch stops immediately on destroy, not after the current chunk's frames finish processing.
- **`@flagify/react`** — exports `FlagifyAuthProviderProps` type for consumers that want to wrap or extend the new auth provider.

### Documentation

- `@flagify/react` README gains **"Common provider tree patterns"** (four scenarios: plain auth, React Query, Zustand/Redux selector, sibling-provider Gate leaf) and **"Why `useFlag` has no user argument"** FAQ sections.
- `@flagify/node` README documents the three new SSE options in the configuration table.
- Website SDK docs at `apps/website/src/content/docs/v1/sdk/react.mdx` mirror the React README changes.

### Repository hygiene

- **`javascript`** — `CLAUDE.md` and `TestAudit.MD` are no longer tracked (#31). These are local AI assistant instructions and internal test-audit notes — useful to developers working on the repo but noise for end users installing `@flagify/node` or `@flagify/react`. Contributors using Claude Code (or similar) should restore their local copies from git history after pulling this release.

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
