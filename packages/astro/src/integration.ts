import type { FlagifyAstroOptions } from "./types";

const FLAG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`;

/**
 * Astro integration for Flagify feature flags.
 *
 * Registers middleware for flag evaluation and a dev toolbar app
 * for toggling flag overrides during development.
 *
 * ```js
 * // astro.config.mjs
 * import { defineConfig } from 'astro/config';
 * import flagify from '@flagify/astro';
 *
 * export default defineConfig({
 *   integrations: [flagify()],
 * });
 * ```
 */
export default function flagifyIntegration(
  _options?: FlagifyAstroOptions,
): {
  name: string;
  hooks: Record<string, (params: any) => void>;
} {
  return {
    name: "@flagify/astro",
    hooks: {
      "astro:config:setup": ({
        addMiddleware,
        addDevToolbarApp,
      }: {
        addMiddleware: (opts: { entrypoint: string; order: string }) => void;
        addDevToolbarApp: (opts: {
          id: string;
          name: string;
          icon: string;
          entrypoint: string | URL;
        }) => void;
      }) => {
        // Inject middleware to init client and parse override cookies
        addMiddleware({
          entrypoint: "@flagify/astro/middleware",
          order: "pre",
        });

        // Add dev toolbar app for flag overrides
        addDevToolbarApp({
          id: "flagify-flags",
          name: "Feature Flags",
          icon: FLAG_ICON,
          entrypoint: new URL("./toolbar/app.js", import.meta.url),
        });
      },
    },
  };
}
