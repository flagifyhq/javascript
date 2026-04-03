import { initClient, waitForClient } from "./client";

const OVERRIDE_COOKIE = "flagify-overrides";

/**
 * Astro middleware that initializes the Flagify client and parses
 * override cookies on each request.
 *
 * Usage in astro.config.mjs — this is auto-injected by the integration,
 * but can also be used standalone:
 *
 * ```ts
 * // src/middleware.ts
 * export { onRequest } from '@flagify/astro/middleware';
 * ```
 */
export const onRequest = async (context: any, next: () => Promise<Response>) => {
  // Lazy-init the singleton client on first request
  const env = (import.meta as any).env ?? {};
  const projectKey: string = env.FLAGIFY_PROJECT_KEY ?? "";
  const publicKey: string = env.FLAGIFY_PUBLIC_KEY ?? "";
  const secretKey: string | undefined = env.FLAGIFY_SECRET_KEY;

  if (projectKey && publicKey) {
    initClient({ projectKey, publicKey, secretKey });
    await waitForClient();
  }

  // Parse override cookie and attach to locals
  let overrides: Record<string, unknown> = {};
  const overrideCookie = context.cookies?.get(OVERRIDE_COOKIE);
  if (overrideCookie) {
    try {
      overrides = JSON.parse(overrideCookie.value);
    } catch {
      // malformed cookie, ignore
    }
  }

  context.locals.flagifyOverrides = overrides;

  return next();
};
