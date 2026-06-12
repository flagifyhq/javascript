# Design — `@flagify/node` platform-neutral entry + `./webhooks` subpath

## Context

`packages/node` builds with `tsup src/index.ts --format esm,cjs --dts` after regenerating the barrel with barrelsby (`pnpm run generate`). `barrelsby.json` excludes `api`, `__tests__`, `debug` but not `webhooks`, so `src/index.ts` re-exports `./webhooks/{construct,errors,types,verify}`. `verify.ts:1` imports `createHmac`/`timingSafeEqual` from bare `"crypto"` at module top level. tsup inlines everything into a single `dist/index.mjs`, so the `import "crypto"` lands in the flat bundle that `@flagify/react` pulls in. Metro cannot resolve `crypto` → every RN/Expo consumer of `@flagify/react@1.5.0` fails at build time. `package.json#exports` currently has only the `"."` condition.

Constraints: publishing happens on tag push only (flagify-release flow); React Native is an explicitly supported target (same release shipped the Hermes `AbortSignal.timeout` fix); docs must be synced in `apps/apps/website/src/content/docs/` and the package README.

## Goals / Non-Goals

**Goals:**
- Main entry (`.`) of `@flagify/node` is platform-neutral: zero Node builtin imports in `dist/index.{mjs,js}`.
- Webhook helpers remain fully functional for server consumers via `@flagify/node/webhooks` (ESM + CJS + types).
- CI guard prevents any future Node builtin from re-entering the main-entry graph (covers `dotenv`/`fs`/`path` regressions too).
- Ship as 1.6.0 with migration note; deprecate both 1.5.0 packages on npm after publish.

**Non-Goals:**
- Lazy/deferred `crypto` resolution at call time (Option B).
- Root re-export shim for backward compatibility with 1.5.0 root imports.
- Changes to webhook verification semantics or the API-side webhook delivery.
- Removing the `dotenv` dependency (only flagged by the guard; isolation is a follow-up unless the guard proves the main entry already pulls it in).

## Decisions

1. **Subpath export over lazy load (Option A over B).** A separate entry makes the server-only surface explicit and keeps the RN failure at *type/import* level instead of runtime. Option B leaves an API that "exists" on RN but throws when called, and lazy `require`/dynamic `import` in dual ESM/CJS output is fragile across bundlers. Rejected alternative: deprecated root re-export with lazy CJS require — adds dual-path complexity for a release that was live only days.
2. **Barrel exclusion via barrelsby config, not manual edit.** Add `"webhooks"` to the `exclude` array in `barrelsby.json` so `pnpm run generate` can never reintroduce the re-exports. A manual `src/index.ts` edit would be overwritten by the next `generate`.
3. **Hand-written `src/webhooks.ts` entry, second tsup entry point.** Change the build script to `tsup src/index.ts src/webhooks.ts --format esm,cjs --dts` (tsup emits `dist/webhooks.{mjs,js,d.ts}` automatically for multi-entry; no `tsup.config.ts` needed — keep the inline-script convention). `src/webhooks.ts` explicitly re-exports `./webhooks/{verify,construct,errors,types}`.
4. **`exports` map gains `"./webhooks"` with explicit `types` condition first** (`types` → `import` → `require`), mirroring the `"."` shape, so `moduleResolution: bundler/node16` consumers resolve types correctly. `"files": ["dist"]` already covers the new outputs.
5. **`node:crypto` prefix.** Explicit builtin protocol; several bundlers (esbuild neutral, modern Metro configs) treat `node:` specifiers as external/unpolyfillable in a clearer way, and it is the modern Node idiom.
6. **CI guard = esbuild neutral bundle, not a Metro fixture.** A Vitest test (esbuild is already in the repo's toolchain via tsup) bundles a fixture importing `@flagify/react` with `platform: 'neutral'` and no builtin externals; build failure or any `node:`/builtin specifier in the metafile fails the test. Metro fixture rejected: heavy install, slow CI, same signal. The guard runs against built `dist/` output (after `pnpm build`) since that is what npm consumers get.
7. **Semver: 1.6.0 (breaking-minor with migration note), then `npm deprecate` both 1.5.0 packages.** Decided with the maintainer: semantically honest within 1.x, and the deprecation warning reaches `^1.x` consumers at install time.

## Risks / Trade-offs

- [Breaking root import for 1.5.0 adopters] → 1.6.0 CHANGELOG migration note + `npm deprecate` of 1.5.0 pointing at the new subpath; blast radius minimal (release days old).
- [Subpath `exports` resolution varies across TS `moduleResolution` settings] → explicit `types` condition per subpath + a type-level resolution test (`tsc --noEmit` consumer fixture).
- [barrelsby drift re-adds webhooks to the barrel] → exclusion lives in `barrelsby.json` (Decision 2) and the CI guard (Decision 6) is a second net.
- [Guard flags `dotenv` immediately] → if `dist/index.mjs` already contains `fs`/`path` via dotenv, scope grows: either isolate dotenv usage behind the same pattern or scope the guard's first iteration to the builtins reachable today and file the dotenv isolation as an immediate follow-up. Resolve during implementation (open question in proposal).
- [tsup multi-entry changes chunking] → verify `dist/index.*` stays self-contained and webhook code is not duplicated into it (check metafile in the guard test).

## Migration Plan

1. Land the package change (barrel exclusion, new entry, exports map, `node:crypto`, CI guard) on a branch → PR in `flagifyhq/javascript`.
2. Release 1.6.0 for `@flagify/node` and `@flagify/react` via the `flagify-release` skill (tag push publishes).
3. `npm deprecate @flagify/node@1.5.0` / `@flagify/react@1.5.0` → "Broken on React Native/Expo; upgrade to 1.6.0 (webhooks moved to @flagify/node/webhooks)".
4. Docs wave: website webhooks docs + `packages/node/README.md`; decision log entry + index in `Flagify Docs/`.
5. Downstream (out of repo): vanguardhq removes its Metro crypto shim after upgrading.
6. Rollback: 1.6.0 is additive at runtime; if the subpath causes resolution issues for some consumer class, a 1.6.1 can re-add a root re-export without reverting the subpath.

## Implementation discoveries (deviations from the original plan)

- **Internal consumers of the root webhook exports existed**: `@flagify/astro` (`src/webhooks.ts`, re-exported from its main entry — server-side SSR, legitimate) and `@flagify/nestjs` (`src/webhooks/` guard + re-export). Both migrated to `@flagify/node/webhooks`. Their own public surfaces are unchanged, so their consumers see no break.
- **Vitest aliases needed a subpath entry**: `packages/astro/vitest.config.ts` and `packages/nestjs/vitest.config.ts` alias `@flagify/node` to `../node/src/index.ts`; the new `@flagify/node/webhooks` specifier required a more-specific alias to `../node/src/webhooks.ts` listed first.
- **`turbo.json` `test.dependsOn` changed `["^build"]` → `["build"]`**: the new dist-level tests (exports map, bundling guard) require the package's own build output, not just upstream builds.
- **`esbuild` added to root devDependencies** (`^0.27.4`, already in the pnpm store) for the bundling guard; `@types/node` added to `@flagify/react` devDependencies for the guard test's `node:*` imports. The guard test runs with `// @vitest-environment node` because react's jsdom environment breaks esbuild's TextEncoder invariant.
- **Negative validation of the guard**: a neutral-platform bundle of the webhooks entry itself fails with `Could not resolve "crypto"` — the exact failure mode 1.5.0 caused in Metro — proving the guard would have caught the regression pre-release.

## Open Questions

- ~~Does the guard's metafile scan show `dotenv` (`fs`/`path`) already present in `dist/index.mjs`?~~ **Resolved during implementation:** `dotenv` is never imported anywhere in `packages/node/src/` — it is a declared-but-unused runtime dependency, so it cannot enter any bundle and the guard passes without an allowlist. Follow-up (separate change): remove the unused `dotenv` dependency.
- Record "server-only additions go behind subpath exports from day 1" as repo policy (CLAUDE.md / contributing) — pending maintainer confirmation.
