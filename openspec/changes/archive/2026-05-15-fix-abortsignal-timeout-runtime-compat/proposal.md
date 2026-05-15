# Fix `AbortSignal.timeout()` runtime incompatibility in `@flagify/node`

## Problem

`@flagify/node`'s HTTP client uses `AbortSignal.timeout(DEFAULT_TIMEOUT_MS)` to enforce a 10s request timeout in both `get()` and `post()`. The static method `AbortSignal.timeout` is only available in **Node.js ≥ 17.3**, modern browsers, and modern Workers runtimes. It is **not available in Hermes** (the React Native engine), nor in older Node versions, nor in some embedded JS runtimes.

When a consumer using `@flagify/react` (which depends on `@flagify/node`) runs the SDK on Hermes / React Native, every call to `httpClient.get|post` throws synchronously with:

```
TypeError: AbortSignal.timeout is not a function (it is undefined)
```

The realtime SSE loop in `realtime.ts` catches transient network errors and retries via `syncFlags()`, which goes through the broken `httpClient` path. The result is an **unrecoverable error loop**: flags never load, and the consumer app sees repeated warnings forever:

```
LOG  [Realtime] connected (id=vKspRx5ll8TrEziPAAAD)
WARN [Flagify] Realtime error (will reconnect): Network request failed
WARN [Flagify] Failed to sync flags after 2 attempts: TypeError: AbortSignal.timeout is not a function (it is undefined)
WARN [Flagify] Realtime error (will reconnect): Network request failed
WARN [Flagify] Failed to sync flags after 2 attempts: TypeError: AbortSignal.timeout is not a function (it is undefined)
...
```

## Scope

- Replace `AbortSignal.timeout(ms)` with a runtime-safe equivalent in `packages/node/src/api/httpClient.ts` (both `get` and `post`).
- Preserve existing semantics: a 10s deadline, request aborted on timeout, fetch promise rejected with an `AbortError`-shaped failure.
- Feature-detect: if the runtime already supports `AbortSignal.timeout`, use it; otherwise fall back to `AbortController` + `setTimeout`.
- Verify the fix works on a runtime where `AbortSignal.timeout` is undefined (Vitest can simulate by deleting the property).
- Document that `@flagify/node` (and therefore `@flagify/react`) supports React Native / Hermes.

## Non-goals

- Changing the realtime retry logic in `realtime.ts`.
- Introducing a polling fallback when realtime fails.
- Replacing `fetch` itself with a different HTTP layer.
- Touching `@flagify/nestjs` or `@flagify/astro` unless they re-export the affected helper.
- Bumping the SDK's minimum Node version.

## Reproduction steps

1. Use a React Native app (Hermes engine, any iOS/Android version) wired with `@flagify/react`.
2. Mount `<FlagifyProvider projectKey publicKey ... />`.
3. Let the SDK connect to realtime once (you'll see `[Realtime] connected (id=...)`).
4. Trigger any transient network error (disable WiFi briefly, switch networks, or use Charles to interrupt the SSE stream).
5. Observe: realtime detects the error, schedules a reconnect, and synchronously calls `syncFlags()` → `httpClient.get()` → `AbortSignal.timeout(...)` → throws `TypeError: AbortSignal.timeout is not a function`.
6. The warning repeats indefinitely; flags never refresh.

The same crash reproduces on Node < 17.3 (where `AbortSignal.timeout` was added).

## Expected behavior

- HTTP requests timeout cleanly at 10s on every supported runtime, regardless of whether `AbortSignal.timeout` is native.
- A transient realtime error leads to a normal reconnect cycle; flags continue to sync once connectivity returns.
- No `TypeError` referencing `AbortSignal.timeout` ever appears.

## Actual behavior

- `AbortSignal.timeout` is `undefined` on Hermes / older Node.
- `httpClient.get` and `httpClient.post` throw synchronously when constructing the fetch options.
- `realtime.ts`'s catch-and-resync path amplifies the failure: every reconnect attempt re-triggers the same crash.
- Flag cache never updates after the first network blip; the SDK is effectively dead until the app restarts on a fully online network.

## Acceptance criteria

- `packages/node/src/api/httpClient.ts` no longer references `AbortSignal.timeout` directly without a guard.
- A request that exceeds the timeout still aborts cleanly with a recognizable error (`name === 'AbortError'` or equivalent), on both runtimes that have and lack `AbortSignal.timeout`.
- New unit test(s) in `packages/node/` verify:
  - `get`/`post` still timeout when `AbortSignal.timeout` is the native implementation.
  - `get`/`post` still timeout when `AbortSignal.timeout` has been removed from the global (simulating Hermes / older Node).
- `pnpm --filter @flagify/node test` passes.
- `pnpm --filter @flagify/node lint` passes (no `any`, strong typing for the helper).
- README in `packages/node/` mentions React Native / Hermes support; React README cross-references it.

## Test plan

- **Unit**: add `httpClient.test.ts` covering: timeout fires on native runtime; timeout fires on a runtime where `AbortSignal.timeout` has been deleted from globalThis; aborted fetch surfaces a clear error.
- **Manual smoke**: reproduce the original log sequence on a React Native sample app (or a Node script with `delete globalThis.AbortSignal.timeout`) and confirm clean reconnect instead of repeated `TypeError`.
- **Regression check**: run the existing `@flagify/node` suite and the `@flagify/react` suite to ensure no behavioral drift on modern Node.

## Risks

- **Polyfill semantics drift**: native `AbortSignal.timeout` rejects with `TimeoutError`; the polyfill should produce an equivalent abort surface so downstream `error.name` checks still behave.
- **Memory leak from stray timers**: the polyfill must clear the `setTimeout` once the fetch resolves/rejects, otherwise long-lived processes (Node servers) accumulate timers.
- **TypeScript types**: `AbortSignal.timeout` is typed in `lib.dom.d.ts`/`@types/node`. The helper must compile cleanly on the SDK's `tsconfig` without `any`.
- **Realtime amplification not addressed**: even after the fix, the SSE layer still calls `syncFlags` on every transient error. Out of scope here, but worth flagging for a follow-up if the retry storm continues for other reasons.

## Open questions

- Is React Native / Hermes an explicitly supported runtime for `@flagify/node`? (Affects whether we also add a CI test against Hermes or just document it.)
- Should we bump the published minimum Node engine in `package.json`, or keep it permissive and rely on the polyfill?
- Should the realtime layer be made smarter about cascading sync failures (debounce / circuit break) in a separate change?
