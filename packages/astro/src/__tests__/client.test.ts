import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch before importing client
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockFetchResponse(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

import { initClient, getClient, waitForClient, destroyClient } from "../client";

describe("client singleton", () => {
  beforeEach(() => {
    destroyClient();
    mockFetch.mockReset();
  });

  it("getClient returns null before init", () => {
    expect(getClient()).toBeNull();
  });

  it("initClient creates a client", async () => {
    mockFetchResponse([]);
    initClient({ projectKey: "proj", publicKey: "pk_test" });
    expect(getClient()).not.toBeNull();
    await waitForClient();
  });

  it("second initClient call is a no-op", async () => {
    mockFetchResponse([]);
    initClient({ projectKey: "proj", publicKey: "pk_test" });
    const first = getClient();

    initClient({ projectKey: "other", publicKey: "pk_other" });
    expect(getClient()).toBe(first);

    await waitForClient();
  });

  it("destroyClient resets to null", async () => {
    mockFetchResponse([]);
    initClient({ projectKey: "proj", publicKey: "pk_test" });
    await waitForClient();

    destroyClient();
    expect(getClient()).toBeNull();
  });

  it("waitForClient resolves after ready", async () => {
    mockFetchResponse([{ key: "test-flag", enabled: true, value: true, type: "boolean" }]);
    initClient({ projectKey: "proj", publicKey: "pk_test" });

    const client = await waitForClient();
    expect(client).not.toBeNull();
    expect(client!.isEnabled("test-flag")).toBe(true);
  });
});
