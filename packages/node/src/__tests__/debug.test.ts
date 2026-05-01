import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

const ORIGINAL_DEBUG_ENV = process.env.FLAGIFY_DEBUG;

afterEach(() => {
  if (ORIGINAL_DEBUG_ENV == null) {
    delete process.env.FLAGIFY_DEBUG;
  } else {
    process.env.FLAGIFY_DEBUG = ORIGINAL_DEBUG_ENV;
  }
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("debug helper (FLAGIFY_DEBUG)", () => {
  describe("when FLAGIFY_DEBUG is unset", () => {
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

  describe("when FLAGIFY_DEBUG=1", () => {
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

  describe("when FLAGIFY_DEBUG is set to anything other than '1'", () => {
    beforeEach(() => {
      process.env.FLAGIFY_DEBUG = "true";
    });

    it("debugEnabled is false (only the literal '1' opts in)", async () => {
      const mod = await import("../debug");
      expect(mod.debugEnabled).toBe(false);
    });
  });
});
