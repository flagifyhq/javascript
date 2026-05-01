/**
 * Gates verbose, auto-recoverable SDK logs (SSE connect/reconnect, flag-change
 * notifications, idle-timeout warnings) behind an opt-in env var so production
 * consoles stay quiet by default.
 *
 * Activation:
 *   - Node / bundlers that inline `process.env`: set `FLAGIFY_DEBUG=1`.
 *   - Browser without a build step: `localStorage.setItem("FLAGIFY_DEBUG", "1")`
 *     and reload (the value is read once at module load).
 *
 * Errors that indicate misconfiguration or non-recoverable failures
 * (missing <FlagifyProvider>, duplicate connect(), failed evaluation after
 * sync) are NOT routed through here — they always log so devs can see them.
 */

function readDebugFlag(): boolean {
  try {
    if (
      typeof process !== "undefined" &&
      process.env != null &&
      process.env.FLAGIFY_DEBUG === "1"
    ) {
      return true;
    }
  } catch {
    // process is undefined in some browser environments; ignore.
  }
  try {
    const ls = (
      globalThis as { localStorage?: { getItem: (key: string) => string | null } }
    ).localStorage;
    if (ls != null && ls.getItem("FLAGIFY_DEBUG") === "1") {
      return true;
    }
  } catch {
    // localStorage may throw in privacy modes; ignore.
  }
  return false;
}

export const debugEnabled: boolean = readDebugFlag();

export const debugLog = {
  info: (...args: unknown[]): void => {
    if (debugEnabled) console.info(...args);
  },
  debug: (...args: unknown[]): void => {
    if (debugEnabled) console.debug(...args);
  },
  warn: (...args: unknown[]): void => {
    if (debugEnabled) console.warn(...args);
  },
};
