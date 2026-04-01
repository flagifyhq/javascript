import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally before importing client
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { Flagify } from "../client";
import type { FlagifyFlaggy } from "../types/FlagifyFlaggy";

function makeFlag(overrides: Partial<FlagifyFlaggy> = {}): FlagifyFlaggy {
  return {
    key: "test-flag",
    name: "Test Flag",
    value: true,
    type: "boolean",
    defaultValue: true,
    enabled: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function mockFetchResponse(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

function createClient(options = {}) {
  return new Flagify({
    projectKey: "test-project",
    publicKey: "pk_dev_test",
    ...options,
  });
}

describe("Flagify client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ready()", () => {
    it("resolves after initial sync", async () => {
      mockFetchResponse([makeFlag()]);
      const client = createClient();
      await expect(client.ready()).resolves.toBeUndefined();
    });

    it("resolves even if sync fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("network error"));
      const client = createClient();
      await expect(client.ready()).resolves.toBeUndefined();
    });
  });

  describe("isEnabled()", () => {
    it("returns true for enabled boolean flag with value true", async () => {
      mockFetchResponse([makeFlag({ key: "dark-mode", enabled: true, value: true })]);
      const client = createClient();
      await client.ready();

      expect(client.isEnabled("dark-mode")).toBe(true);
    });

    it("returns value for enabled boolean flag", async () => {
      mockFetchResponse([makeFlag({ key: "dark-mode", enabled: true, value: false })]);
      const client = createClient();
      await client.ready();

      expect(client.isEnabled("dark-mode")).toBe(false);
    });

    it("returns defaultValue for disabled boolean flag", async () => {
      mockFetchResponse([makeFlag({ key: "dark-mode", enabled: false, value: true, defaultValue: false })]);
      const client = createClient();
      await client.ready();

      expect(client.isEnabled("dark-mode")).toBe(false);
    });

    it("returns true defaultValue for disabled boolean flag with default true", async () => {
      mockFetchResponse([makeFlag({ key: "dark-mode", enabled: false, value: false, defaultValue: true })]);
      const client = createClient();
      await client.ready();

      expect(client.isEnabled("dark-mode")).toBe(true);
    });

    it("returns false for non-existent flag", async () => {
      mockFetchResponse([]);
      const client = createClient();
      await client.ready();

      expect(client.isEnabled("nope")).toBe(false);
    });

    it("returns false for non-boolean flag type", async () => {
      mockFetchResponse([
        makeFlag({ key: "config", type: "string", enabled: true }),
      ]);
      const client = createClient();
      await client.ready();

      expect(client.isEnabled("config")).toBe(false);
    });
  });

  describe("getValue()", () => {
    it("returns value for enabled flag", async () => {
      mockFetchResponse([
        makeFlag({
          key: "max-retries",
          type: "number",
          value: 5,
          defaultValue: 3,
          enabled: true,
        }),
      ]);
      const client = createClient();
      await client.ready();

      expect(client.getValue<number>("max-retries", 0)).toBe(5);
    });

    it("returns defaultValue for disabled flag", async () => {
      mockFetchResponse([
        makeFlag({
          key: "max-retries",
          type: "number",
          value: 5,
          defaultValue: 3,
          enabled: false,
        }),
      ]);
      const client = createClient();
      await client.ready();

      expect(client.getValue<number>("max-retries", 10)).toBe(3);
    });

    it("returns fallback for non-existent flag", async () => {
      mockFetchResponse([]);
      const client = createClient();
      await client.ready();

      expect(client.getValue<number>("nope", 42)).toBe(42);
    });
  });

  describe("syncFlags()", () => {
    it("fetches from /v1/eval/flags with x-api-key header", async () => {
      mockFetchResponse([makeFlag()]);
      createClient();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/eval/flags"),
        expect.objectContaining({
          headers: expect.objectContaining({
            "x-api-key": "pk_dev_test",
          }),
        }),
      );
    });
  });

  describe("getVariant()", () => {
    it("returns variant key with highest weight", async () => {
      mockFetchResponse([
        makeFlag({
          key: "checkout",
          type: "string",
          enabled: true,
          variants: [
            { key: "control", value: "Welcome", weight: 50 },
            { key: "variant-a", value: "Hi", weight: 30 },
            { key: "variant-b", value: "Hey", weight: 20 },
          ],
        }),
      ]);
      const client = createClient();
      await client.ready();

      expect(client.getVariant("checkout", "fallback")).toBe("control");
    });

    it("returns fallback when flag has no variants", async () => {
      mockFetchResponse([makeFlag({ key: "feat", enabled: true })]);
      const client = createClient();
      await client.ready();

      expect(client.getVariant("feat", "default")).toBe("default");
    });

    it("returns fallback when flag is disabled", async () => {
      mockFetchResponse([
        makeFlag({
          key: "checkout",
          enabled: false,
          variants: [{ key: "control", value: "x", weight: 100 }],
        }),
      ]);
      const client = createClient();
      await client.ready();

      expect(client.getVariant("checkout", "fallback")).toBe("fallback");
    });

    it("returns fallback when flag missing", async () => {
      mockFetchResponse([]);
      const client = createClient();
      await client.ready();

      expect(client.getVariant("nope", "default")).toBe("default");
    });
  });

  describe("evaluateWithUser()", () => {
    it("calls POST /v1/eval/flags/evaluate when user is provided", async () => {
      // First call: GET /v1/eval/flags
      mockFetchResponse([
        makeFlag({ key: "analytics", enabled: true, value: false }),
      ]);
      // Second call: POST /v1/eval/flags/evaluate
      mockFetchResponse([
        { key: "analytics", value: true, reason: "targeting_rule" },
      ]);

      const client = createClient({
        options: { user: { id: "pro1", plan: "pro" } },
      });
      await client.ready();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("/v1/eval/flags/evaluate"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("updates cached value from evaluation result", async () => {
      mockFetchResponse([
        makeFlag({ key: "analytics", type: "boolean", enabled: true, value: false }),
      ]);
      mockFetchResponse([
        { key: "analytics", value: true, reason: "targeting_rule" },
      ]);

      const client = createClient({
        options: { user: { id: "pro1", plan: "pro" } },
      });
      await client.ready();

      expect(client.isEnabled("analytics")).toBe(true);
    });

    it("keeps original value when no user is provided", async () => {
      mockFetchResponse([
        makeFlag({ key: "analytics", type: "boolean", enabled: true, value: false }),
      ]);

      const client = createClient();
      await client.ready();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      // Boolean flag: enabled=true, value=false → isEnabled()=false
      expect(client.isEnabled("analytics")).toBe(false);
    });

    it("sends userId and attributes in POST body", async () => {
      mockFetchResponse([makeFlag()]);
      mockFetchResponse([]);

      const user = { id: "u42", plan: "enterprise", role: "admin" };
      createClient({ options: { user } });

      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      const postCall = mockFetch.mock.calls[1];
      const body = JSON.parse(postCall[1].body);
      expect(body.userId).toBe("u42");
      expect(body.attributes).toEqual(user);
    });

    it("falls back gracefully if evaluate endpoint fails", async () => {
      mockFetchResponse([
        makeFlag({ key: "feat", type: "boolean", enabled: true, value: false }),
      ]);
      // Evaluate fails
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500, statusText: "Internal Server Error" });

      const client = createClient({
        options: { user: { id: "u1" } },
      });
      await client.ready();

      // Boolean flag: enabled=true, value=false → isEnabled()=false
      expect(client.isEnabled("feat")).toBe(false);
    });
  });

  describe("polling", () => {
    it("calls syncFlags periodically when pollIntervalMs is set", async () => {
      vi.useFakeTimers();

      // Initial sync
      mockFetchResponse([makeFlag({ key: "feat", enabled: true, value: true })]);

      const client = createClient({ options: { pollIntervalMs: 1000 } });
      await client.ready();

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // First poll
      mockFetchResponse([makeFlag({ key: "feat", enabled: true, value: false })]);
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockFetch).toHaveBeenCalledTimes(2);

      client.destroy();
      vi.useRealTimers();
    });

    it("triggers onFlagChange on each poll", async () => {
      vi.useFakeTimers();

      mockFetchResponse([makeFlag()]);
      const client = createClient({ options: { pollIntervalMs: 500 } });
      await client.ready();

      const onChange = vi.fn();
      client.onFlagChange = onChange;

      mockFetchResponse([makeFlag()]);
      await vi.advanceTimersByTimeAsync(500);

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ flagKey: "*", action: "updated" }),
      );

      client.destroy();
      vi.useRealTimers();
    });

    it("stops polling after destroy()", async () => {
      vi.useFakeTimers();

      mockFetchResponse([makeFlag()]);
      const client = createClient({ options: { pollIntervalMs: 500 } });
      await client.ready();

      client.destroy();

      await vi.advanceTimersByTimeAsync(1500);

      // Only the initial sync call, no poll calls
      expect(mockFetch).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  describe("destroy()", () => {
    it("does not throw when no realtime", async () => {
      mockFetchResponse([]);
      const client = createClient();
      await client.ready();

      expect(() => client.destroy()).not.toThrow();
    });
  });

  describe("onFlagChange callback", () => {
    it("is called when a flag is refetched", async () => {
      mockFetchResponse([
        makeFlag({ key: "feat", enabled: true }),
      ]);
      const client = createClient({ options: { staleTimeMs: 1 } });
      await client.ready();

      const onChange = vi.fn();
      client.onFlagChange = onChange;

      // Wait for the flag to become stale
      await new Promise((r) => setTimeout(r, 5));

      // Trigger refetch via stale read
      mockFetchResponse(makeFlag({ key: "feat", enabled: false }));
      client.getValue("feat", false);

      // Wait for async refetch
      await new Promise((r) => setTimeout(r, 50));

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ flagKey: "feat", action: "updated" }),
      );
    });
  });
});
