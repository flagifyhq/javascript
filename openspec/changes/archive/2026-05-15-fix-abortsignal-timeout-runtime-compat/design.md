## Context

`@flagify/node` (used directly on servers and transitively by `@flagify/react`, `@flagify/nestjs`, and `@flagify/astro`) issues every outbound HTTP request through a small wrapper in `packages/node/src/api/httpClient.ts`. Both `get()` and `post()` set `signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)` to enforce a 10s deadline.

`AbortSignal.timeout` is a static method standardized later than the rest of the `AbortController`/`AbortSignal` family. It ships in:

- Node.js ≥ 17.3
- Modern Chromium, Firefox, Safari
- Cloudflare Workers, Deno, Bun

It does **not** ship in:

- **Hermes** (the default React Native engine) — confirmed by the live `TypeError: AbortSignal.timeout is not a function (it is undefined)` crash from the proposal's reproduction.
- Node.js < 17.3 (still in some long-tail environments).
- Older embedded JS runtimes (some IoT/edge platforms).

The crash is amplified by `realtime.ts`: on a transient SSE error it calls `syncFlags()` → `httpClient.get()`, so a single network blip turns into an infinite log loop.

This change is small in surface area (one file, two call sites) but cross-cutting in impact: every product that uses any Flagify JS SDK on a non-standard runtime is currently broken.

## Goals / Non-Goals

**Goals:**

- Eliminate the `TypeError: AbortSignal.timeout is not a function` crash on Hermes and Node < 17.3.
- Preserve the existing semantics: 10s deadline, `AbortError`-shaped failure on timeout, clean cleanup of timers on success.
- Keep the public API of `createHttpClient` and the exported `FlagifyHttpClient` interface untouched — no consumer changes required.
- Add unit coverage that pins both branches (native + polyfill) so future regressions are caught.
- Make React Native / Hermes support explicit in the README so users know it works.

**Non-Goals:**

- Changing the realtime retry strategy (`realtime.ts`).
- Adding a polling fallback when realtime fails.
- Replacing `fetch` with an alternative HTTP layer (e.g., `undici`, `axios`).
- Bumping `engines.node` in `packages/node/package.json`.
- Touching `@flagify/nestjs` or `@flagify/astro` code paths; they inherit the fix transitively.

## Decisions

### Decision 1: Feature-detect `AbortSignal.timeout` and fall back to `AbortController` + `setTimeout`

Use the native implementation when available; otherwise build the equivalent abort surface with primitives that exist in every JS runtime we target.

```ts
function createTimeoutSignal(ms: number): { signal: AbortSignal; cancel: () => void } {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return { signal: AbortSignal.timeout(ms), cancel: () => {} };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException("The operation timed out.", "TimeoutError"));
  }, ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}
```

**Alternatives considered:**

- **Always use `AbortController` + `setTimeout` (drop the native branch).** Simpler, one code path. Rejected because the native implementation is implemented at the platform layer and is microscopically more efficient (no userland timer); preserving it on modern runtimes is free.
- **Ship a third-party polyfill (e.g., `abort-controller-x`).** Rejected: extra dependency for ~15 lines of code; SDK is dependency-light by design.
- **`Promise.race([fetch(...), timeoutPromise])`.** Rejected: doesn't actually abort the in-flight request, just abandons the promise. Connections keep streaming, defeating the purpose of a timeout.

**Why `DOMException("...", "TimeoutError")` for the abort reason:** matches the spec-defined behavior of native `AbortSignal.timeout` (per WHATWG DOM spec), so downstream `err.name === "TimeoutError"` checks behave identically on both branches. `DOMException` is available on every targeted runtime, including Hermes (since RN 0.71), Node ≥ 17, and all browsers.

### Decision 2: Cancel the polyfill's timer when the request settles

When `fetch` resolves or rejects before the deadline, we must `clearTimeout()`; otherwise long-lived processes (Node servers handling thousands of requests/sec) accumulate timers and the controller keeps a reference until GC.

Implementation: wrap the fetch call in `try/finally` and call the `cancel()` returned by `createTimeoutSignal`.

```ts
const { signal, cancel } = createTimeoutSignal(DEFAULT_TIMEOUT_MS);
try {
  const res = await fetch(url, { method, headers, signal });
  ...
} finally {
  cancel();
}
```

For the native branch `cancel` is a no-op, so there's no runtime cost.

**Alternative considered:** rely on GC to clean up. Rejected because the controller's `AbortSignal` is referenced by the running timer until it fires, which extends timer lifetime to a fixed 10s per call regardless of how fast the request completes — measurable on burst traffic.

### Decision 3: Keep the helper inside `httpClient.ts` (no separate file)

The helper is ~15 lines, only used here, and tightly coupled to the timeout semantics of this client. Inlining it keeps the module self-contained and avoids growing the `api/` directory for a one-off.

**Alternative considered:** extract to `packages/node/src/utils/timeout.ts`. Could be revisited if a second call site appears, but premature today.

### Decision 4: Type the helper without `any`

Return type is `{ signal: AbortSignal; cancel: () => void }`. Both `AbortSignal` and `AbortController` are in `lib.dom.d.ts`/`@types/node` already, so no extra ambient types are needed.

### Decision 5: Test both branches in the same file

Use Vitest's `vi.stubGlobal` to selectively replace `AbortSignal` with a version where `timeout` is `undefined`, then re-import `httpClient` to exercise the fallback. Two `describe` blocks (native + polyfill) keep the matrix obvious.

## Risks / Trade-offs

- **[Risk] Polyfill rejects with a different error shape than native.** → Mitigation: use `DOMException("...", "TimeoutError")` as the abort reason; assert `error.name === "TimeoutError"` in tests on both branches.

- **[Risk] Memory leak from stray `setTimeout` handles.** → Mitigation: `try/finally` + `cancel()`. Verified by a unit test that asserts `clearTimeout` is called on the success path.

- **[Risk] `DOMException` not available on a future target runtime.** → Mitigation: every runtime currently in scope (Node ≥ 14, Hermes since RN 0.71, all evergreen browsers, Workers, Deno, Bun) ships `DOMException`. If a future target lacks it, we'd fall back to `new Error("Timeout")` with `name = "TimeoutError"`. Not implemented now to avoid YAGNI.

- **[Trade-off] Two branches instead of one.** → Slightly more code than the "always polyfill" approach, but preserves native-path efficiency on modern runtimes and is exhaustively tested.

- **[Risk] React Native users still hit realtime amplification.** → Out of scope here; flagged in the proposal's "Open questions" and tracked as a separate follow-up. This change alone eliminates the `TypeError` and lets the existing realtime/sync loop succeed on retry.

## Migration Plan

- **No consumer migration required.** Public API is unchanged; only the internal implementation of `httpClient.ts` shifts.
- **Versioning:** ship as a patch bump of `@flagify/node` (per the SDK's tag-push publish workflow). `@flagify/react` re-installs the new `@flagify/node` transitively on the next tag.
- **Rollback:** revert the single commit; previous behavior (broken on Hermes) returns. Acceptable because the rollback restores a known prior state.

## Open Questions

These mirror the proposal's open questions; the change resolves the immediate crash regardless of how they're answered.

- **CI coverage on Hermes?** Today: simulated via `delete globalThis.AbortSignal.timeout` in Vitest. A real RN smoke test is desirable but out of scope here.
- **Bump `engines.node`?** Recommendation: leave at the current minimum and let the polyfill cover < 17.3. Revisit when Node 16 is EOL across our user base.
- **Realtime circuit breaker?** Track as a separate proposal if the post-fix retry storm proves problematic in practice.
