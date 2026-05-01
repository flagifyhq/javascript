/**
 * Gates verbose, auto-recoverable SDK logs (SSE connect/reconnect, flag-change
 * notifications, idle-timeout warnings) behind an opt-in env var so production
 * consoles stay quiet by default.
 *
 * Activation:
 *   - Node / bundlers that inline `process.env`: set `FLAGIFY_DEBUG=1`.
 *   - Browser without a build step: `localStorage.setItem("FLAGIFY_DEBUG", "1")`
 *     and reload.
 *
 * The flag is read **once at module load**. Mutating `process.env.FLAGIFY_DEBUG`
 * or `localStorage.FLAGIFY_DEBUG` after import has no effect — reload the
 * process or the page to re-evaluate.
 *
 * This module is internal: it is intentionally excluded from the public barrel
 * (`barrelsby.json` `exclude` list) so renaming `debugLog`/`debugEnabled` does
 * not break consumers. Errors that indicate misconfiguration or non-recoverable
 * failures (missing <FlagifyProvider>, duplicate connect(), failed evaluation
 * after sync, auth failures, SSE parse errors) are NOT routed through here —
 * they always log so devs can see them.
 */

function readDebugFlag(): boolean {
  // `typeof` on an undeclared identifier is safe by spec, but accessing
  // `process.env.FLAGIFY_DEBUG` could throw in exotic runtimes that define
  // `process` as a getter (Edge runtime shims, sandboxed iframes). The catch
  // is defensive — every realistic Node/browser/bundler path skips it.
  try {
    if (
      typeof process !== "undefined" &&
      process.env != null &&
      process.env.FLAGIFY_DEBUG === "1"
    ) {
      return true;
    }
  } catch {
    /* defensive: getter on process or process.env threw */
  }
  // `localStorage.getItem` can throw in Safari private mode (pre-iOS 11),
  // sandboxed iframes, and some SSR shims that expose a stub that throws.
  try {
    const ls = (
      globalThis as { localStorage?: { getItem: (key: string) => string | null } }
    ).localStorage;
    if (ls != null && ls.getItem("FLAGIFY_DEBUG") === "1") {
      return true;
    }
  } catch {
    /* defensive: privacy mode / sandboxed iframe */
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
