import type { FlagifyUser } from "@flagify/node";
import { getClient, waitForClient } from "./client";

interface FlagAdapter<T, E> {
  decide: (params: { entities?: E; defaultValue?: T }) => Promise<T>;
  origin?: string;
}

/**
 * Creates a Flagify adapter compatible with the Vercel Flags SDK.
 *
 * ```ts
 * import { createFlagifyAdapter } from '@flagify/astro/adapter';
 *
 * const { adapter } = createFlagifyAdapter();
 *
 * export const newCheckout = flag({
 *   key: 'new-checkout-flow',
 *   adapter: adapter('new-checkout-flow'),
 *   defaultValue: false,
 * });
 * ```
 */
export function createFlagifyAdapter(options?: { origin?: string }) {
  const baseOrigin = options?.origin ?? "https://app.flagify.dev";

  return {
    adapter: <T>(key: string): FlagAdapter<T, FlagifyUser> => ({
      decide: async ({ entities, defaultValue }) => {
        const client = await waitForClient();
        if (!client) return defaultValue as T;

        if (entities) {
          const result = await client.evaluate(key, entities);
          return result.value as T;
        }

        return client.getValue<T>(key, defaultValue as T);
      },
      origin: `${baseOrigin}/flags/${key}`,
    }),
  };
}
