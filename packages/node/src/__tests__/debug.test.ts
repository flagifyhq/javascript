import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

const ORIGINAL_DEBUG_ENV = process.env.FLAGIFY_DEBUG;

type LocalStorageStub = {
  getItem: (key: string) => string | null;
};

function stubLocalStorage(stub: LocalStorageStub | null): () => void {
  const previous = (globalThis as { localStorage?: LocalStorageStub })
    .localStorage;
  if (stub == null) {
    delete (globalThis as { localStorage?: LocalStorageStub }).localStorage;
  } else {
    (globalThis as { localStorage?: LocalStorageStub }).localStorage = stub;
  }
  return () => {
    if (previous === undefined) {
      delete (globalThis as { localStorage?: LocalStorageStub }).localStorage;
    } else {
      (globalThis as { localStorage?: LocalStorageStub }).localStorage = previous;
    }
  };
}

beforeEach(() => {
  // Force a fresh module load every test so the top-level IIFE in debug.ts
  // re-reads the env / localStorage state we set up below.
  vi.resetModules();
});

afterEach(() => {
  if (ORIGINAL_DEBUG_ENV == null) {
    delete process.env.FLAGIFY_DEBUG;
  } else {
    process.env.FLAGIFY_DEBUG = ORIGINAL_DEBUG_ENV;
  }
  vi.restoreAllMocks();
});

describe("debug helper (FLAGIFY_DEBUG)", () => {
  describe("when FLAGIFY_DEBUG is unset and no localStorage", () => {
    beforeEach(() => {
      delete process.env.FLAGIFY_DEBUG;
    });

    it("debugEnabled is false and debugLog is silent at every level", async () => {
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const mod = await import("../debug");
      expect(mod.debugEnabled).toBe(false);

      mod.debugLog.info("hello");
      mod.debugLog.debug("hello");
      mod.debugLog.warn("hello");

      expect(infoSpy).not.toHaveBeenCalled();
      expect(debugSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe("when FLAGIFY_DEBUG=1 (env)", () => {
    beforeEach(() => {
      process.env.FLAGIFY_DEBUG = "1";
    });

    it("debugEnabled is true and debugLog forwards to console", async () => {
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const mod = await import("../debug");
      expect(mod.debugEnabled).toBe(true);

      mod.debugLog.info("a");
      mod.debugLog.debug("b");
      mod.debugLog.warn("c");

      expect(infoSpy).toHaveBeenCalledWith("a");
      expect(debugSpy).toHaveBeenCalledWith("b");
      expect(warnSpy).toHaveBeenCalledWith("c");
    });
  });

  describe("when FLAGIFY_DEBUG is set to a non-'1' value", () => {
    beforeEach(() => {
      process.env.FLAGIFY_DEBUG = "true";
    });

    it("debugEnabled is false AND debugLog stays silent", async () => {
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const mod = await import("../debug");
      expect(mod.debugEnabled).toBe(false);

      mod.debugLog.info("a");
      mod.debugLog.debug("b");
      mod.debugLog.warn("c");

      expect(infoSpy).not.toHaveBeenCalled();
      expect(debugSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe("localStorage path (browser without env-var inlining)", () => {
    it("activates when localStorage.FLAGIFY_DEBUG === '1' and env is unset", async () => {
      delete process.env.FLAGIFY_DEBUG;
      const restore = stubLocalStorage({
        getItem: (key) => (key === "FLAGIFY_DEBUG" ? "1" : null),
      });
      try {
        const mod = await import("../debug");
        expect(mod.debugEnabled).toBe(true);
      } finally {
        restore();
      }
    });

    it("does NOT activate when localStorage.FLAGIFY_DEBUG is something else", async () => {
      delete process.env.FLAGIFY_DEBUG;
      const restore = stubLocalStorage({
        getItem: () => "yes",
      });
      try {
        const mod = await import("../debug");
        expect(mod.debugEnabled).toBe(false);
      } finally {
        restore();
      }
    });

    it("survives a localStorage.getItem that throws (privacy mode / sandboxed iframe)", async () => {
      delete process.env.FLAGIFY_DEBUG;
      const restore = stubLocalStorage({
        getItem: () => {
          throw new Error("denied");
        },
      });
      try {
        const mod = await import("../debug");
        expect(mod.debugEnabled).toBe(false);
        // And debugLog stays silent — the module did not crash on import.
        const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
        mod.debugLog.info("a");
        expect(infoSpy).not.toHaveBeenCalled();
      } finally {
        restore();
      }
    });
  });
});
