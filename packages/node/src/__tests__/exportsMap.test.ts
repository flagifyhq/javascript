import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, it } from "vitest";

// These tests assert the PUBLISHED artifacts (dist/ + package.json#exports),
// not the TypeScript source: they catch exports-map regressions that unit
// tests resolving through src/ can never see.
const packageDir = fileURLToPath(new URL("../..", import.meta.url));
const fixturesDir = join(packageDir, "test-fixtures", "exports-consumer");
const nodeRequire = createRequire(import.meta.url);

function runNodeScript(scriptPath: string): void {
  execFileSync(process.execPath, [scriptPath], {
    cwd: packageDir,
    stdio: "pipe",
  });
}

function runTsc(tsconfigName: string): void {
  const tscPath = nodeRequire.resolve("typescript/lib/tsc.js");
  execFileSync(
    process.execPath,
    [tscPath, "-p", join(fixturesDir, tsconfigName)],
    { cwd: fixturesDir, stdio: "pipe" },
  );
}

describe("package exports map (built dist)", () => {
  beforeAll(() => {
    if (!existsSync(join(packageDir, "dist", "webhooks.mjs"))) {
      throw new Error(
        "dist/ is missing — run `pnpm build` before `pnpm test` (turbo does this automatically).",
      );
    }
  });

  it("resolves @flagify/node/webhooks via the import condition (ESM)", () => {
    runNodeScript(join(fixturesDir, "check-esm.mjs"));
  });

  it("resolves @flagify/node/webhooks via the require condition (CJS)", () => {
    runNodeScript(join(fixturesDir, "check-cjs.cjs"));
  });

  it("resolves subpath types under moduleResolution: bundler", () => {
    runTsc("tsconfig.bundler.json");
  });

  it("resolves subpath types under moduleResolution: node16", () => {
    runTsc("tsconfig.node16.json");
  });
});
