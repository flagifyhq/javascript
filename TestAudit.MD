# Test Suite Audit — Flagify JavaScript SDK

> Audited: 2026-03-30  
> Auditor: Senior Software Engineer & Test Auditor  
> Scope: full test suite (`packages/node` + `packages/react`)

---

## File 1: `packages/node/src/__tests__/client.test.ts`

---

### Issue 1 — `ready()`: No post-condition assertion after sync

**File + test**: `client.test.ts` → `ready() > resolves after initial sync`

**Problem**: The test only confirms that `ready()` resolves to `undefined`. It never verifies that the flag cache was actually populated. `syncFlags()` could silently swallow the data or iterate over nothing, and `ready()` would still resolve to `undefined`.

**Why it's dangerous**: False confidence. If `syncFlags()` accidentally does nothing with the response (e.g., a `flags.forEach` instead of `for...of` on a non-iterable), the test still passes. Any subsequent `isEnabled` / `getValue` call would always return fallbacks, and the test suite wouldn't catch it.

**Suggested fix**:
```ts
it("resolves after initial sync and populates the cache", async () => {
  mockFetchResponse([makeFlag({ key: "dark-mode", enabled: true })]);
  const client = createClient();
  await client.ready();
  // Confirm the flag is actually in the cache
  expect(client.isEnabled("dark-mode")).toBe(true);
});
```

---

### Issue 2 — `ready()`: Graceful degradation is only half-tested

**File + test**: `client.test.ts` → `ready() > resolves even if sync fails`

**Problem**: The test confirms `ready()` doesn't reject on network failure, but never verifies that the degraded state is safe. After a failed sync the flag cache is empty, so every flag lookup should return its fallback — but the test doesn't assert this.

**Why it's dangerous**: A regression that makes `isEnabled` throw (instead of returning `false`) on an empty cache would not be caught here.

**Suggested fix**:
```ts
it("resolves even if sync fails, returning fallbacks for all flags", async () => {
  mockFetch.mockRejectedValueOnce(new Error("network error"));
  const client = createClient();
  await client.ready();
  expect(client.isEnabled("any-flag")).toBe(false);
  expect(client.getValue("any-flag", "default")).toBe("default");
  expect(client.getVariant("any-flag", "ctrl")).toBe("ctrl");
});
```

---

### Issue 3 — `isEnabled()`: Tests validate the wrong field, masking a likely bug

**File + test**: `client.test.ts` → `isEnabled() > returns true for enabled boolean flag`

**Problem**: The actual implementation is:

```ts
return cached.flag.enabled ? Boolean(cached.flag.defaultValue) : false;
```

It returns `defaultValue`, **not** `value`. The `FlagifyFlaggy` type's own JSDoc describes `value` as *"the value that will be returned when the flag is evaluated"* and `defaultValue` as the fallback when no targeting rules match. But the implementation ignores `value` entirely.

The test uses `makeFlag({ key: "dark-mode", enabled: true })`, which defaults to `defaultValue: true`. Since `Boolean(true) === true`, the test passes — but for the wrong reason. If you swap `value: true` and `defaultValue: false`, `isEnabled` returns `false` on an enabled flag, and no test catches it.

**Why it's dangerous**: The tests are validating a bug. Any developer reading them would believe returning `defaultValue` is the intended contract, when the type docs say it should be `value`. This is the most dangerous false-confidence issue in the suite.

**Suggested fix**:

First, clarify the design intent. If `value` should drive evaluation:
```ts
return cached.flag.enabled ? Boolean(cached.flag.value) : false;
```

Then add a test that distinguishes the two fields:
```ts
it("returns the value field (not defaultValue) for an enabled flag", async () => {
  // value=true, defaultValue=false — if impl uses defaultValue, this returns false
  mockFetchResponse([
    makeFlag({ key: "f", type: "boolean", enabled: true, value: true, defaultValue: false }),
  ]);
  const client = createClient();
  await client.ready();
  expect(client.isEnabled("f")).toBe(true); // must be driven by `value`, not `defaultValue`
});
```

---

### Issue 4 — `isEnabled()`: Stale path skips the boolean-type guard

**File + test**: `client.test.ts` → `isEnabled() > returns false for non-boolean flag type` (and by absence, the stale path)

**Problem**: The production code has two early-return paths:

```ts
if (this.isStale(cached)) {
  this.refetchFlag(flagKey);
  return Boolean(cached.flag.defaultValue); // ← no type check
}
if (cached.flag.type !== "boolean") return false;
```

A non-boolean stale flag bypasses the type guard and returns `Boolean(defaultValue)`. No test covers this combination (`type: "string"` + stale cache).

**Why it's dangerous**: A stale string flag with `defaultValue: "some-string"` would cause `isEnabled` to return `true` — the boolean flag guard is silently bypassed. This is a real runtime bug that the suite does not catch.

**Suggested fix**:
```ts
it("returns false for a stale non-boolean flag (type guard still applies)", async () => {
  mockFetchResponse([
    makeFlag({ key: "cfg", type: "string", enabled: true, defaultValue: "hello" }),
  ]);
  const client = createClient({ options: { staleTimeMs: 1 } });
  await client.ready();
  await new Promise((r) => setTimeout(r, 5));
  mockFetchResponse(makeFlag({ key: "cfg", type: "string" })); // stale refetch
  expect(client.isEnabled("cfg")).toBe(false); // must not return Boolean("hello")
});
```

---

### Issue 5 — `getValue()`: Test name and behavior describe a likely bug

**File + test**: `client.test.ts` → `getValue() > returns defaultValue for enabled flag`

**Problem**: The test name itself says "returns **defaultValue**" — but according to `FlagifyFlaggy`'s JSDoc, `value` is *"the value that will be returned when the flag is evaluated"* and `defaultValue` is a fallback for targeting-rule misses. `getValue` never reads `flag.value`. The test validates this behavior without questioning it.

**Why it's dangerous**: The test suite gives a green light to an implementation that ignores the `value` field entirely. Consider: `value: "prod-banner"` and `defaultValue: "default-banner"` on an enabled flag — `getValue` returns `"default-banner"`. The entire `value` field is dead code.

**Suggested fix**:
```ts
it("returns the evaluated value (not defaultValue) for an enabled flag", async () => {
  mockFetchResponse([
    makeFlag({ key: "banner", type: "string", enabled: true, value: "prod-banner", defaultValue: "default-banner" }),
  ]);
  const client = createClient();
  await client.ready();
  expect(client.getValue<string>("banner", "fallback")).toBe("prod-banner");
});
```

---

### Issue 6 — `syncFlags()`: Assertion is too weak and the test is incomplete

**File + test**: `client.test.ts` → `syncFlags() > fetches from /v1/eval/flags with x-api-key header`

**Problem**:
1. `createClient()` is called but the return value (and its `ready()` promise) is discarded. The assertion runs synchronously — it works only because `mockFetch` is invoked synchronously inside the constructor. This is fragile and not the intended test pattern.
2. `expect.stringContaining("/v1/eval/flags")` also matches `/v1/eval/flags/someFlag` (the per-flag refetch endpoint), so it wouldn't catch a wrong URL path.
3. `Content-Type: application/json` header is not verified.
4. No project-key header is checked — the project key might be expected to be sent but isn't verified.

**Suggested fix**:
```ts
it("fetches from the correct /v1/eval/flags endpoint with required headers", async () => {
  mockFetchResponse([makeFlag()]);
  const client = createClient();
  await client.ready();
  expect(mockFetch).toHaveBeenCalledWith(
    expect.stringMatching(/\/v1\/eval\/flags$/),
    expect.objectContaining({
      method: "GET",
      headers: expect.objectContaining({
        "x-api-key": "pk_dev_test",
        "Content-Type": "application/json",
      }),
    }),
  );
});
```

---

### Issue 7 — `getVariant()`: No coverage for equal weights or edge cases

**File + test**: `client.test.ts` → `getVariant() > returns variant key with highest weight`

**Problem**: The test uses weights `[50, 30, 20]` — the winner is unambiguous. The implementation uses a linear scan with strict `>` comparison:

```ts
if (variants[i].weight > best.weight) best = variants[i];
```

With equal weights, the **first** variant always wins. There is no test for equal weights, all-zero weights, a single variant, or negative weights. Tie-breaking policy is undefined in docs and untested.

**Suggested fix**:
```ts
it("returns the first variant when all weights are equal (tie-breaking policy)", async () => {
  mockFetchResponse([
    makeFlag({
      key: "ab",
      enabled: true,
      variants: [
        { key: "a", value: "x", weight: 50 },
        { key: "b", value: "y", weight: 50 },
      ],
    }),
  ]);
  const client = createClient();
  await client.ready();
  expect(client.getVariant("ab", "fallback")).toBe("a"); // first-wins documented behavior
});
```

---

### Issue 8 — `onFlagChange` callback: Timing-dependent, cache update unverified

**File + test**: `client.test.ts` → `onFlagChange callback > is called when a flag is refetched`

**Problems**:
1. **Timing dependence**: Uses `setTimeout(r, 5)` and `setTimeout(r, 50)`. On a loaded CI runner, 5 ms may not be enough for the flag to go stale. The test is non-deterministic and a known source of flaky CI failures.
2. **Cache update not verified**: The test confirms `onFlagChange` fires, but never calls `getValue` after the refetch to verify the cache actually holds the new value (`enabled: false`).
3. **Partial assertion**: `expect.objectContaining({ flagKey: "feat", action: "updated" })` ignores `environmentId`, which is hardcoded to `""` in `refetchFlag` — a likely placeholder bug.

**Suggested fix**: Use `vi.useFakeTimers()` and verify the updated cache value:
```ts
it("updates the cache and fires onFlagChange after a stale refetch", async () => {
  vi.useFakeTimers();
  mockFetchResponse([makeFlag({ key: "feat", enabled: true })]);
  const client = createClient({ options: { staleTimeMs: 100 } });
  await client.ready();

  const onChange = vi.fn();
  client.onFlagChange = onChange;

  vi.advanceTimersByTime(200); // make the flag stale

  mockFetchResponse(makeFlag({ key: "feat", enabled: false, defaultValue: false }));
  client.getValue("feat", true);

  await vi.runAllTimersAsync();

  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ flagKey: "feat", action: "updated" }),
  );
  // Verify cache was updated
  expect(client.getValue("feat", true)).toBe(false);
  vi.useRealTimers();
});
```

---

### Issue 9 — `destroy()`: Only the no-realtime path is tested

**File + test**: `client.test.ts` → `destroy() > does not throw when no realtime`

**Problem**: The test verifies that calling `destroy()` on a client with no realtime is safe. But there is no test for `destroy()` on a client with `options.realtime: true`. The meaningful behavior — `this.realtime.disconnect()` being called, `this.realtime` being set to `null` — is never validated.

**Suggested fix**:
```ts
it("disconnects the realtime listener on destroy", async () => {
  mockFetchResponse([]);
  mockFetch.mockReturnValueOnce(new Promise(() => {})); // SSE stream never resolves
  const client = createClient({ options: { realtime: true } });
  // destroy should not throw and should abort the SSE connection
  expect(() => client.destroy()).not.toThrow();
  // Calling destroy again should be safe (no double-disconnect)
  expect(() => client.destroy()).not.toThrow();
});
```

---

### Issue 10 — `evaluate()` method: Zero test coverage

**File + test**: `client.test.ts` — missing entirely

**Problem**: The `evaluate(flagKey, user)` method is defined on `IFlagifyClient`, exported, and documented. It performs a POST to `/v1/eval/flags/:key/evaluate`. It is never tested. There is no test for:
- Correct URL construction
- Correct payload (`userId`, `attributes`)
- Response parsing
- HTTP error handling (4xx/5xx)

**Why it's dangerous**: `evaluate()` is a core API integration point. A silent breakage in the POST body structure would ship undetected.

---

### Issue 11 — `validateConfig()`: Missing-key warnings are untested

**File + test**: `client.test.ts` — missing entirely

**Problem**: `validateConfig()` calls `console.error` when `publicKey` or `projectKey` is absent. The system continues operating (with all flags defaulting to off). No test verifies this behavior, and no test checks that an absent key is handled gracefully (vs. throwing).

**Suggested fix**:
```ts
it("logs an error and returns fallbacks when publicKey is missing", async () => {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  mockFetchResponse([]);
  const client = new Flagify({ projectKey: "proj", publicKey: "" });
  await client.ready();
  expect(spy).toHaveBeenCalledWith(
    expect.stringContaining("publicKey"),
    expect.any(String),
  );
  expect(client.isEnabled("any")).toBe(false);
  spy.mockRestore();
});
```

---

## File 2: `packages/react/src/__tests__/hooks.test.tsx`

---

### Issue 12 — All React hook tests use a hand-rolled mock client, not the real `Flagify` class

**File + test**: `hooks.test.tsx` — all tests

**Problem**: `createMockClient` re-implements `isEnabled`, `getValue`, and `getVariant` from scratch using its own logic (e.g. reading `.value` instead of `.defaultValue`). The React tests therefore test the React wiring against a mock that has **different semantics** from the real `Flagify` client.

Concretely:
- Real `isEnabled`: `Boolean(cached.flag.defaultValue)` when enabled
- Mock `isEnabled`: `Boolean(f.value)` when enabled

If the real `Flagify.isEnabled` has a bug (see Issue 3), the React hook tests would still pass because they never exercise the real class.

**Why it's dangerous**: The entire React test suite can be green while the real end-to-end behavior is broken. These tests give confidence about React rendering logic but provide zero integration coverage.

**Suggested fix**: Add at least one integration test per hook that uses the real `Flagify` class backed by a mocked `fetch`. Existing mock-based tests can remain as unit tests but should not be the only coverage.

---

### Issue 13 — `re-render on version change`: Test does not validate its stated purpose

**File + test**: `hooks.test.tsx` → `re-render on version change > hooks re-render when version increments`

**Problem**: This is the most misleading test in the entire suite. The test:
1. Renders with `version = 0` and `useFlag("feat")` returning `true`.
2. Sets `version = 1` and calls `rerender()`.
3. Asserts `result.current` is still `true`.

The flag data never changes between renders. Both assertions check the same value (`true`). This test would pass identically if `version` was never read by any hook at all. It does not validate that the version mechanism drives re-renders when data changes.

**Why it's dangerous**: The whole point of `version` is to force re-renders when flag data changes via SSE. The test gives the illusion this is working when it tests nothing of the sort.

**Suggested fix**:
```ts
it("returns updated flag value after version increment triggers re-render", () => {
  let flagEnabled = true;
  const client = {
    ...createMockClient({}),
    isEnabled: (key: string) => flagEnabled && key === "feat",
  } as unknown as Flagify;
  let version = 0;

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <FlagifyContext.Provider value={{ client, isReady: true, version }}>
      {children}
    </FlagifyContext.Provider>
  );

  const { result, rerender } = renderHook(() => useFlag("feat"), { wrapper: Wrapper });
  expect(result.current).toBe(true);

  // Simulate SSE flag change: flag flips to disabled and version bumps
  flagEnabled = false;
  version = 1;
  rerender();

  expect(result.current).toBe(false); // hook must have re-evaluated with new data
});
```

---

### Issue 14 — `useFlagifyClient`: Error is caught inside the hook, not via `expect().toThrow()`

**File + test**: `hooks.test.tsx` → `useFlagifyClient > throws when used outside provider`

**Problem**: The test wraps the hook call in a `try/catch` inside `renderHook` and returns the caught error as the result. This is fragile — a future refactor that makes `useFlagifyClient` return `null` instead of throwing would pass this test (since `null` is not `instanceof Error`). The test structure also bypasses React error boundary reporting.

**Suggested fix**:
```ts
it("throws when used outside provider (client is null)", () => {
  expect(() => renderHook(() => useFlagifyClient())).toThrow("FlagifyProvider");
});
```

---

### Issue 15 — `FlagifyProvider` component: Zero test coverage

**File + test**: `hooks.test.tsx` — missing entirely

**Problem**: `FlagifyProvider.tsx` contains substantial logic:
- Creates a `Flagify` instance in `useEffect`
- Registers `onFlagChange = bumpVersion`
- Calls `instance.ready()` and sets `isReady: true`
- Tears down the instance on unmount (`destroy()`)
- Skips state updates if the instance was replaced (stale-closure guard)
- Re-creates the client when `projectKey` or `publicKey` changes

None of this is tested. Critical paths not covered include:
- Does `isReady` flip to `true` after `ready()` resolves?
- Does `destroy()` get called on unmount?
- Does `version` increment when `onFlagChange` fires?
- Is a stale instance's state update ignored?

---

### Issue 16 — `useIsReady`: No test for the `false → true` transition

**File + test**: `hooks.test.tsx` → `useIsReady`

**Problem**: Two separate static renders are tested — one with `isReady: false` and one with `isReady: true`. There is no test that the hook correctly reflects a **state transition** (the real-world case where the provider initializes asynchronously).

**Suggested fix**:
```ts
it("reflects the transition from not-ready to ready", () => {
  let isReady = false;
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <FlagifyContext.Provider value={{ client: null, isReady, version: 0 }}>
      {children}
    </FlagifyContext.Provider>
  );
  const { result, rerender } = renderHook(() => useIsReady(), { wrapper: Wrapper });
  expect(result.current).toBe(false);
  isReady = true;
  rerender();
  expect(result.current).toBe(true);
});
```

---

### Issue 17 — `RealtimeListener`: Zero test coverage

**File + test**: `packages/node/src/__tests__/` — missing entirely

**Problem**: `realtime.ts` contains ~135 lines of SSE streaming logic with:
- Exponential back-off reconnection
- Frame parsing (`parseSSEFrame`)
- Abort signal handling
- Reconnect-on-stream-end
- Error event forwarding

None of it is tested. The SSE parser could silently drop events with multi-line data, mis-parse event types, or never fire `onConnected` — and the test suite would remain entirely green.

---

## Final Summary

### Overall Test Suite Reliability Score: **3 / 10**

The tests cover only the happy-path surface of two modules (`Flagify` client and React hooks) and do so in a way that hides real implementation bugs. Entire subsystems (`RealtimeListener`, `FlagifyProvider`, `evaluate()`, `validateConfig()`) have zero coverage.

---

### Top 5 Risks in the Current Test Strategy

| # | Risk | Impact |
|---|------|--------|
| 1 | **Tests validate `defaultValue` instead of `value`** — both `isEnabled` and `getValue` silently ignore the `value` field. Tests confirm this bug rather than catching it. Entire flag evaluation logic is subtly broken for any flag where `value ≠ defaultValue`. | **Critical** |
| 2 | **React tests use a hand-rolled mock with different semantics than the real client.** If `Flagify`'s behavior changes (or is already wrong), all React hook tests remain green. There is no integration-level coverage. | **High** |
| 3 | **`RealtimeListener` is completely untested.** SSE parsing, reconnection logic, and abort handling are production-critical paths with zero test coverage. | **High** |
| 4 | **`FlagifyProvider` lifecycle is completely untested.** The entire React provider — client creation, readiness propagation, version bumping on SSE, and cleanup on unmount — has no tests. | **High** |
| 5 | **Timing-dependent test for `onFlagChange`** uses real `setTimeout` delays, making it inherently flaky in slow CI environments. The test also does not verify the cache is actually updated after the refetch. | **Medium** |

---

### Concrete Recommendations

1. **Clarify and fix `value` vs `defaultValue`**: Decide which field `getValue` and `isEnabled` should use and add tests that explicitly distinguish them (e.g., a flag with `value: "prod"` and `defaultValue: "dev"` — the test must assert which is returned).

2. **Add integration tests for `RealtimeListener`**: Use a `ReadableStream` mock to feed SSE frames and assert that `onFlagChange`, `onConnected`, and `onError` fire correctly. Test the reconnect back-off with `vi.useFakeTimers()`.

3. **Add tests for `FlagifyProvider`**: Use `@testing-library/react`'s `render` with a mocked `fetch` to verify `isReady`, `version` bumping, and `destroy()` on unmount.

4. **Replace the hand-rolled mock client in React tests** with the real `Flagify` class backed by `vi.stubGlobal("fetch", ...)`. This eliminates the mock-divergence risk and ensures React hooks are tested against real evaluation logic.

5. **Add `evaluate()` tests**: Cover the POST payload shape, response parsing, and HTTP error handling (4xx, 5xx). Use `vi.useFakeTimers()` instead of real delays throughout to eliminate flakiness.
