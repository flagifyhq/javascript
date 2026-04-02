import type { FlagDefinition } from "./types";
import { getClient } from "./client";

const OVERRIDE_COOKIE = "flagify-overrides";

export interface FlagEvaluator<T> {
  (astro: { cookies: { get(name: string): { value: string } | undefined } }): Promise<T>;
  _definition: FlagDefinition<T>;
}

/**
 * Define a feature flag that can be evaluated in Astro pages and components.
 *
 * Returns an async function that accepts the Astro global object
 * and resolves the flag value with this priority:
 * 1. Override cookie value (for dev testing)
 * 2. Flagify SDK evaluation
 * 3. Default fallback
 */
export function defineFlag<T>(definition: FlagDefinition<T>): FlagEvaluator<T> {
  const evaluate = async (astro: {
    cookies: { get(name: string): { value: string } | undefined };
  }): Promise<T> => {
    // 1. Check override cookie first (dev overrides take priority)
    const overrideCookie = astro.cookies.get(OVERRIDE_COOKIE);
    if (overrideCookie) {
      try {
        const overrides = JSON.parse(overrideCookie.value);
        if (definition.key in overrides) {
          return overrides[definition.key] as T;
        }
      } catch {
        // malformed cookie, ignore
      }
    }

    // 2. Evaluate via the singleton Flagify client
    const client = getClient();
    if (!client) return definition.default;

    if (typeof definition.default === "boolean") {
      return client.isEnabled(definition.key) as T;
    }

    return client.getValue<T>(definition.key, definition.default);
  };

  evaluate._definition = definition;

  return evaluate as FlagEvaluator<T>;
}
