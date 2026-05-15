import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { createHttpClient } from "../api/httpClient";

const baseConfig = {
  projectKey: "test-project",
  publicKey: "pk_dev_test",
  options: { apiUrl: "https://api.example.test" },
};

function makeAbortListeningFetch(): ReturnType<typeof vi.fn> {
  return vi.fn((_url: string, init?: RequestInit) => {
    return new Promise((_resolve, reject) => {
      const signal = init?.signal;
      if (!signal) {
        reject(new Error("missing signal"));
        return;
      }
      signal.addEventListener("abort", () => {
        const reason = (signal as AbortSignal & { reason?: unknown }).reason;
        reject(reason instanceof Error ? reason : new Error("aborted"));
      });
    });
  });
}

describe("httpClient timeout — native AbortSignal.timeout branch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("invokes AbortSignal.timeout(10_000) and passes the resulting signal to fetch", async () => {
    expect(typeof AbortSignal.timeout).toBe("function");

    const nativeTimeout = AbortSignal.timeout.bind(AbortSignal);
    const sentinelSignal = nativeTimeout(60_000);
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockImplementation(() => sentinelSignal);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => Promise.resolve({ ok: true }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const client = createHttpClient(baseConfig);
    await client.get("/v1/flags");

    expect(timeoutSpy).toHaveBeenCalledWith(10_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBe(sentinelSignal);
  });
});

describe("httpClient timeout — fallback branch (no AbortSignal.timeout)", () => {
  const originalAbortSignal = globalThis.AbortSignal;
  const originalTimeout = originalAbortSignal.timeout;

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(originalAbortSignal, "timeout", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    expect((globalThis.AbortSignal as { timeout?: unknown }).timeout).toBeUndefined();
  });

  afterEach(() => {
    Object.defineProperty(originalAbortSignal, "timeout", {
      value: originalTimeout,
      configurable: true,
      writable: true,
    });
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not throw TypeError and aborts with TimeoutError after the deadline", async () => {
    const fetchMock = makeAbortListeningFetch();
    vi.stubGlobal("fetch", fetchMock);

    const client = createHttpClient(baseConfig);
    const promise = client.get("/v1/flags").catch((err: Error) => err);

    await vi.advanceTimersByTimeAsync(10_000);
    const err = (await promise) as Error;

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("TimeoutError");
    expect(err.message).not.toMatch(/AbortSignal\.timeout is not a function/);
  });

  it("works identically for post()", async () => {
    const fetchMock = makeAbortListeningFetch();
    vi.stubGlobal("fetch", fetchMock);

    const client = createHttpClient(baseConfig);
    const promise = client.post("/v1/evaluate", { key: "x" }).catch((err: Error) => err);

    await vi.advanceTimersByTimeAsync(10_000);
    const err = (await promise) as Error;

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("TimeoutError");
  });

  it("clears the setTimeout handle when the request resolves before the deadline", async () => {
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => Promise.resolve({ ok: true }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const client = createHttpClient(baseConfig);
    await client.get("/v1/flags");

    expect(clearSpy).toHaveBeenCalled();
  });

  it("clears the setTimeout handle when the request rejects before the deadline", async () => {
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");

    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const client = createHttpClient(baseConfig);
    await expect(client.get("/v1/flags")).rejects.toThrow("network down");

    expect(clearSpy).toHaveBeenCalled();
  });
});
