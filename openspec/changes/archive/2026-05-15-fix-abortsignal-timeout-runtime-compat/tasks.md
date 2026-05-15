## 1. Implementation

- [x] 1.1 Add `createTimeoutSignal(ms)` helper in `packages/node/src/api/httpClient.ts` that feature-detects `AbortSignal.timeout` and falls back to `AbortController` + `setTimeout` with a `DOMException("...", "TimeoutError")` abort reason; returns `{ signal, cancel }`.
- [x] 1.2 Replace `signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)` in `get()` with the helper, wrapping the `fetch` call in `try/finally` so `cancel()` always runs.
- [x] 1.3 Replace `signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)` in `post()` with the helper, wrapping the `fetch` call in `try/finally` so `cancel()` always runs.
- [x] 1.4 Verify `tsc --noEmit` (i.e. `pnpm --filter @flagify/node lint`) passes — no `any`, no unused imports.

## 2. Tests

- [x] 2.1 Create `packages/node/src/__tests__/httpClient.test.ts` with a Vitest suite that mocks global `fetch` and `AbortSignal`.
- [x] 2.2 Add a "native branch" describe block: assert `AbortSignal.timeout` is used when present, that the request aborts after the timeout, and that the rejection error has `name === "TimeoutError"`.
- [x] 2.3 Add a "fallback branch" describe block: stub `AbortSignal` so `timeout` is `undefined`, assert no `TypeError` is thrown, that the request aborts after the timeout, and that the rejection error has `name === "TimeoutError"`.
- [x] 2.4 Add a "timer cleanup" test on the fallback branch: spy on `clearTimeout`, run a request that resolves successfully before the deadline, and assert `clearTimeout` was called.
- [x] 2.5 Run `pnpm --filter @flagify/node test` and confirm the new file and all existing suites pass.

## 3. Documentation

- [x] 3.1 Update `packages/node/README.md` to list React Native / Hermes alongside Node.js and modern browsers in the supported-runtimes section.
- [x] 3.2 Update `packages/react/README.md` to cross-reference the React Native support note (one-line mention with a link to the node README section is sufficient).
- [x] 3.3 Add a decision entry at `Flagify Docs/decisions/2026-05-14-abortsignal-timeout-runtime-compat.md` with the mandatory `## Decisiones clave (para codex review)` block and update `Flagify Docs/README.md` index.

## 4. Verification

- [x] 4.1 From `javascript/`, run `pnpm --filter @flagify/node lint && pnpm --filter @flagify/node test && pnpm --filter @flagify/node build` and confirm all three pass.
- [x] 4.2 From `javascript/`, run `pnpm --filter @flagify/react test` to confirm the React SDK suite still passes against the patched node SDK.
