import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderHook, act } from "@testing-library/react";
import { FlagifyContext, type FlagifyContextValue } from "../context";
import { useFlag } from "../useFlag";
import { useFlagValue } from "../useFlagValue";
import { useVariant } from "../useVariant";
import { useIsReady } from "../useIsReady";
import { useFlagifyClient } from "../useFlagifyClient";
import type { Flagify } from "@flagify/node";

function createMockClient(flags: Record<string, { enabled: boolean; type: string; value: unknown }> = {}): Flagify {
  return {
    isEnabled(key: string) {
      const f = flags[key];
      if (!f || f.type !== "boolean") return false;
      return f.enabled ? Boolean(f.value) : false;
    },
    getValue<T>(key: string, fallback: T): T {
      const f = flags[key];
      if (!f) return fallback;
      return f.enabled ? (f.value as T) : fallback;
    },
    ready: () => Promise.resolve(),
    destroy: vi.fn(),
    onFlagChange: null,
  } as unknown as Flagify;
}

function createWrapper(ctx: FlagifyContextValue) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <FlagifyContext.Provider value={ctx}>
        {children}
      </FlagifyContext.Provider>
    );
  };
}

describe("React hooks", () => {
  describe("useFlag", () => {
    it("returns true for enabled boolean flag", () => {
      const client = createMockClient({ "dark-mode": { enabled: true, type: "boolean", value: true } });
      const wrapper = createWrapper({ client, isReady: true, version: 0 });
      const { result } = renderHook(() => useFlag("dark-mode"), { wrapper });
      expect(result.current).toBe(true);
    });

    it("returns false for disabled flag", () => {
      const client = createMockClient({ "dark-mode": { enabled: false, type: "boolean", value: true } });
      const wrapper = createWrapper({ client, isReady: true, version: 0 });
      const { result } = renderHook(() => useFlag("dark-mode"), { wrapper });
      expect(result.current).toBe(false);
    });

    it("returns false for missing flag", () => {
      const client = createMockClient({});
      const wrapper = createWrapper({ client, isReady: true, version: 0 });
      const { result } = renderHook(() => useFlag("nope"), { wrapper });
      expect(result.current).toBe(false);
    });
  });

  describe("useFlagValue", () => {
    it("returns value for enabled flag", () => {
      const client = createMockClient({ "banner": { enabled: true, type: "string", value: "hello" } });
      const wrapper = createWrapper({ client, isReady: true, version: 0 });
      const { result } = renderHook(() => useFlagValue<string>("banner", "default"), { wrapper });
      expect(result.current).toBe("hello");
    });

    it("returns fallback for disabled flag", () => {
      const client = createMockClient({ "banner": { enabled: false, type: "string", value: "hello" } });
      const wrapper = createWrapper({ client, isReady: true, version: 0 });
      const { result } = renderHook(() => useFlagValue<string>("banner", "default"), { wrapper });
      expect(result.current).toBe("default");
    });

    it("returns fallback for missing flag", () => {
      const client = createMockClient({});
      const wrapper = createWrapper({ client, isReady: true, version: 0 });
      const { result } = renderHook(() => useFlagValue<number>("nope", 42), { wrapper });
      expect(result.current).toBe(42);
    });
  });

  describe("useVariant", () => {
    it("returns variant string", () => {
      const client = createMockClient({ "checkout": { enabled: true, type: "string", value: "variant-a" } });
      const wrapper = createWrapper({ client, isReady: true, version: 0 });
      const { result } = renderHook(() => useVariant("checkout", "control"), { wrapper });
      expect(result.current).toBe("variant-a");
    });

    it("returns fallback when disabled", () => {
      const client = createMockClient({ "checkout": { enabled: false, type: "string", value: "variant-a" } });
      const wrapper = createWrapper({ client, isReady: true, version: 0 });
      const { result } = renderHook(() => useVariant("checkout", "control"), { wrapper });
      expect(result.current).toBe("control");
    });
  });

  describe("useIsReady", () => {
    it("returns false when not ready", () => {
      const wrapper = createWrapper({ client: null, isReady: false, version: 0 });
      const { result } = renderHook(() => useIsReady(), { wrapper });
      expect(result.current).toBe(false);
    });

    it("returns true when ready", () => {
      const client = createMockClient({});
      const wrapper = createWrapper({ client, isReady: true, version: 0 });
      const { result } = renderHook(() => useIsReady(), { wrapper });
      expect(result.current).toBe(true);
    });
  });

  describe("useFlagifyClient", () => {
    it("throws when used outside provider (client is null)", () => {
      const { result } = renderHook(() => {
        try {
          return useFlagifyClient();
        } catch (e) {
          return e;
        }
      });
      expect(result.current).toBeInstanceOf(Error);
      expect((result.current as Error).message).toContain("FlagifyProvider");
    });

    it("returns client when inside provider", () => {
      const client = createMockClient({});
      const wrapper = createWrapper({ client, isReady: true, version: 0 });
      const { result } = renderHook(() => useFlagifyClient(), { wrapper });
      expect(result.current).toBe(client);
    });
  });

  describe("re-render on version change", () => {
    it("hooks re-render when version increments", () => {
      const client = createMockClient({ "feat": { enabled: true, type: "boolean", value: true } });
      let version = 0;

      const Wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlagifyContext.Provider value={{ client, isReady: true, version }}>
          {children}
        </FlagifyContext.Provider>
      );

      const { result, rerender } = renderHook(() => useFlag("feat"), { wrapper: Wrapper });
      expect(result.current).toBe(true);

      // Simulate version bump (as SSE would trigger)
      version = 1;
      rerender();
      expect(result.current).toBe(true);
    });
  });
});
