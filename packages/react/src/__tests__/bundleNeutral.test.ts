// @vitest-environment node
import { existsSync } from "node:fs";
import { builtinModules } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";
import { beforeAll, describe, expect, it } from "vitest";

// CI guard for the 1.5.0 React Native regression: bundling a consumer of
// @flagify/react on a platform WITHOUT Node builtins (Metro, neutral esbuild)
// must succeed, and the main-entry graph of @flagify/node must stay free of
// Node standard library imports. Webhook helpers (node:crypto) are only
// allowed behind the @flagify/node/webhooks subpath.
const reactPackageDir = fileURLToPath(new URL("../..", import.meta.url));
const nodeDistEntry = join(
  reactPackageDir,
  "..",
  "node",
  "dist",
  "index.mjs",
);

const NODE_BUILTINS = new Set(builtinModules);

function isNodeBuiltin(specifier: string): boolean {
  return specifier.startsWith("node:") || NODE_BUILTINS.has(specifier);
}

describe("neutral-platform bundling guard", () => {
  beforeAll(() => {
    if (!existsSync(nodeDistEntry)) {
      throw new Error(
        "@flagify/node dist/ is missing — run `pnpm build` before `pnpm test` (turbo does this automatically).",
      );
    }
  });

  it("bundles a @flagify/react consumer without any Node builtin in the graph", async () => {
    const result = await build({
      stdin: {
        contents: `
          import { FlagifyProvider, useFlag } from "@flagify/react";
          export const consumed = [FlagifyProvider, useFlag];
        `,
        resolveDir: reactPackageDir,
        loader: "ts",
        sourcefile: "rn-like-consumer.ts",
      },
      bundle: true,
      platform: "neutral",
      format: "esm",
      write: false,
      metafile: true,
      logLevel: "silent",
      alias: {
        // The react SDK is bundled from source (its own dist may not exist
        // yet); @flagify/node is resolved to its BUILT main entry — the exact
        // artifact npm consumers get and the one Metro failed on in 1.5.0.
        "@flagify/react": join(reactPackageDir, "src", "index.ts"),
        "@flagify/node": nodeDistEntry,
      },
      external: ["react", "react/jsx-runtime", "react-dom"],
    });

    const builtinImports: string[] = [];
    for (const [inputPath, input] of Object.entries(result.metafile.inputs)) {
      for (const imported of input.imports) {
        if (isNodeBuiltin(imported.path)) {
          builtinImports.push(`${inputPath} -> ${imported.path}`);
        }
      }
    }

    expect(builtinImports).toEqual([]);
  });
});
