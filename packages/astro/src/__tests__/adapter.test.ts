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

import { createFlagifyAdapter } from "../adapter";
import { initClient, destroyClient, waitForClient } from "../client";

describe("createFlagifyAdapter", () => {
  beforeEach(() => {
    destroyClient();
    mockFetch.mockReset();
  });

  it("returns an object with an adapter method", () => {
    const { adapter } = createFlagifyAdapter();
    expect(typeof adapter).toBe("function");
  });

  it("adapter returns object with decide and origin", () => {
    const { adapter } = createFlagifyAdapter();
    const flagAdapter = adapter<boolean>("test-flag");
    expect(typeof flagAdapter.decide).toBe("function");
    expect(flagAdapter.origin).toBe("https://app.flagify.dev/flags/test-flag");
  });

  it("uses custom origin when provided", () => {
    const { adapter } = createFlagifyAdapter({ origin: "https://custom.app" });
    const flagAdapter = adapter<boolean>("my-flag");
    expect(flagAdapter.origin).toBe("https://custom.app/flags/my-flag");
  });

  it("decide returns defaultValue when client is not initialized", async () => {
    const { adapter } = createFlagifyAdapter();
    const flagAdapter = adapter<boolean>("test-flag");
    const result = await flagAdapter.decide({ defaultValue: false });
    expect(result).toBe(false);
  });

  it("decide uses getValue when no entities provided", async () => {
    mockFetchResponse([{ key: "test-flag", enabled: true, value: true, type: "boolean" }]);
    initClient({ projectKey: "proj", publicKey: "pk_test" });
    await waitForClient();

    const { adapter } = createFlagifyAdapter();
    const flagAdapter = adapter<boolean>("test-flag");
    const result = await flagAdapter.decide({ defaultValue: false });
    expect(result).toBe(true);
  });

  it("decide uses evaluate when entities provided", async () => {
    // First call: syncFlags
    mockFetchResponse([{ key: "test-flag", enabled: true, value: false, type: "boolean" }]);
    initClient({ projectKey: "proj", publicKey: "pk_test" });
    await waitForClient();

    // Next call: evaluate endpoint
    mockFetchResponse({ key: "test-flag", value: true, reason: "targeting_rule" });

    const { adapter } = createFlagifyAdapter();
    const flagAdapter = adapter<boolean>("test-flag");
    const result = await flagAdapter.decide({
      entities: { id: "user-123", email: "test@example.com" },
      defaultValue: false,
    });
    expect(result).toBe(true);
  });
});
