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
    it("returns true for enabled boolean flag", async () => {
      mockFetchResponse([makeFlag({ key: "dark-mode", enabled: true })]);
      const client = createClient();
      await client.ready();

      expect(client.isEnabled("dark-mode")).toBe(true);
    });

    it("returns false for disabled boolean flag", async () => {
      mockFetchResponse([makeFlag({ key: "dark-mode", enabled: false })]);
      const client = createClient();
      await client.ready();

      expect(client.isEnabled("dark-mode")).toBe(false);
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
    it("returns defaultValue for enabled flag", async () => {
      mockFetchResponse([
        makeFlag({
          key: "max-retries",
          type: "number",
          defaultValue: 5,
          enabled: true,
        }),
      ]);
      const client = createClient();
      await client.ready();

      expect(client.getValue<number>("max-retries", 0)).toBe(5);
    });

    it("returns fallback for disabled flag", async () => {
      mockFetchResponse([
        makeFlag({
          key: "max-retries",
          type: "number",
          defaultValue: 5,
          enabled: false,
        }),
      ]);
      const client = createClient();
      await client.ready();

      expect(client.getValue<number>("max-retries", 10)).toBe(10);
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
