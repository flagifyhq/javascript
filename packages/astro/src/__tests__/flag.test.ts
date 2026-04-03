import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch before importing modules
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockFetchResponse(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

import { defineFlag } from "../flag";
import { initClient, destroyClient } from "../client";

function createMockAstro(overrides?: Record<string, unknown>) {
  return {
    cookies: {
      get(name: string) {
        if (name === "flagify-overrides" && overrides) {
          return { value: JSON.stringify(overrides) };
        }
        return undefined;
      },
    },
  };
}

describe("defineFlag", () => {
  beforeEach(() => {
    destroyClient();
    mockFetch.mockReset();
  });

  it("returns a callable function with _definition metadata", () => {
    const flag = defineFlag({ key: "test", default: false });
    expect(typeof flag).toBe("function");
    expect(flag._definition.key).toBe("test");
    expect(flag._definition.default).toBe(false);
  });

  it("returns default when client is not initialized", async () => {
    const flag = defineFlag({ key: "new-feature", default: false });
    const result = await flag(createMockAstro());
    expect(result).toBe(false);
  });

  it("returns default string when client is not initialized", async () => {
    const flag = defineFlag({ key: "variant", default: "control" });
    const result = await flag(createMockAstro());
    expect(result).toBe("control");
  });

  it("override cookie takes precedence over SDK value", async () => {
    mockFetchResponse([{ key: "new-feature", enabled: true, value: true, type: "boolean" }]);
    initClient({ projectKey: "proj", publicKey: "pk_test" });

    const flag = defineFlag({ key: "new-feature", default: false });
    const astro = createMockAstro({ "new-feature": false });

    const result = await flag(astro);
    expect(result).toBe(false);
  });

  it("evaluates boolean flag via isEnabled when no override", async () => {
    mockFetchResponse([{ key: "dark-mode", enabled: true, value: true, type: "boolean" }]);
    initClient({ projectKey: "proj", publicKey: "pk_test" });

    // Wait for sync
    const { waitForClient } = await import("../client");
    await waitForClient();

    const flag = defineFlag({ key: "dark-mode", default: false });
    const result = await flag(createMockAstro());
    expect(result).toBe(true);
  });

  it("evaluates non-boolean flag via getValue when no override", async () => {
    mockFetchResponse([{ key: "theme", enabled: true, value: "dark", type: "string" }]);
    initClient({ projectKey: "proj", publicKey: "pk_test" });

    const { waitForClient } = await import("../client");
    await waitForClient();

    const flag = defineFlag({ key: "theme", default: "light" });
    const result = await flag(createMockAstro());
    expect(result).toBe("dark");
  });

  it("ignores malformed override cookie gracefully", async () => {
    const flag = defineFlag({ key: "test", default: "fallback" });
    const astro = {
      cookies: {
        get(name: string) {
          if (name === "flagify-overrides") {
            return { value: "not-valid-json{{{" };
          }
          return undefined;
        },
      },
    };

    const result = await flag(astro);
    expect(result).toBe("fallback");
  });
});
