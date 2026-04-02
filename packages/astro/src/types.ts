import type { FlagifyOptions, FlagifyUser } from "@flagify/node";

/**
 * Options passed to the flagify() integration in astro.config.mjs.
 */
export interface FlagifyAstroOptions extends FlagifyOptions {
  /**
   * Function to extract user context from the request.
   * Called by middleware on each request.
   * If not provided, no user context is set.
   */
  identify?: (context: {
    cookies: Record<string, string>;
    headers: Headers;
    url: URL;
  }) => FlagifyUser | undefined;
}

/**
 * Shape of a flag definition passed to defineFlag().
 */
export interface FlagDefinition<T> {
  key: string;
  description?: string;
  default: T;
  options?: Array<T | { value: T; label: string }>;
}

/**
 * What gets stored in context.locals by the middleware.
 */
export interface FlagifyLocals {
  flagifyOverrides: Record<string, unknown>;
}
