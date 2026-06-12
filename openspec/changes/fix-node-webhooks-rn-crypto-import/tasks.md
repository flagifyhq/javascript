# Tasks — fix-node-webhooks-rn-crypto-import

## 1. Isolate webhooks behind subpath entry (`packages/node`)

- [x] 1.1 Add `"webhooks"` to the `exclude` array in `packages/node/barrelsby.json` and run `pnpm run generate`; verify `src/index.ts` no longer re-exports `./webhooks/*`
- [x] 1.2 Create hand-written entry `packages/node/src/webhooks.ts` re-exporting `./webhooks/verify`, `./webhooks/construct`, `./webhooks/errors`, `./webhooks/types`
- [x] 1.3 Change `verify.ts` (and any other webhook module using builtins) to import from `node:crypto` instead of `crypto`
- [x] 1.4 Update `build`/`dev` scripts to `tsup src/index.ts src/webhooks.ts --format esm,cjs --dts`; confirm `dist/webhooks.{mjs,js,d.ts}` are emitted and `dist/index.*` contains no webhook/crypto code
- [x] 1.5 Add `"./webhooks"` condition (`types`, `import`, `require`) to `packages/node/package.json#exports`, mirroring the `"."` shape

## 2. Tests and CI guard

- [x] 2.1 Move/point existing webhook unit tests at the `@flagify/node/webhooks` surface; add a negative test asserting `verifyWebhookSignature` is not exported from the root entry
- [x] 2.2 Add subpath resolution tests: ESM import, CJS require, and a `tsc --noEmit` consumer fixture covering `moduleResolution` bundler/node16 (`packages/node/src/__tests__/exportsMap.test.ts` + `test-fixtures/exports-consumer/`)
- [x] 2.3 Add the CI bundling guard: Vitest test that runs esbuild with `platform: 'neutral'` (no builtin externals) over a fixture importing `@flagify/react` against built `dist/`, failing on bundle error or any Node builtin specifier in the main-entry metafile (`packages/react/src/__tests__/bundleNeutral.test.ts`; negative check verified — neutral bundle of the webhooks entry fails with `Could not resolve "crypto"`)
- [x] 2.4 Resolve open question: check whether the guard flags `dotenv` (`fs`/`path`) in `dist/index.mjs` — RESOLVED: `dotenv` has zero imports anywhere in `packages/node/src/`, so it never enters any bundle; no allowlist needed. Follow-up: it is an unused runtime dependency and can be dropped in a separate change
- [x] 2.5 Full gate: `pnpm build && pnpm lint && pnpm test` green in `javascript/` (4/4 build, 5/5 lint, all test suites green across node/react/nestjs/astro)

## 3. Docs and changelog

- [x] 3.1 Update `packages/node/README.md` webhooks section to import from `@flagify/node/webhooks`
- [x] 3.2 Update website docs (`apps/apps/website/src/content/docs/`) webhooks examples to the subpath import (`sdk/javascript.mdx`, `concepts/webhooks.mdx`, `sdk/nestjs.mdx`; also fixed `sdk/react-native.mdx` which recommended upgrading to the broken v1.5.0)
- [x] 3.3 CHANGELOG: 1.6.0 entry with **BREAKING** migration note (webhooks moved to subpath) and a notice that 1.5.0 is broken on React Native/Expo

## 4. Release and registry

- [ ] 4.1 Open PR in `flagifyhq/javascript` (branch, never push main); merge after review
- [ ] 4.2 Cut release 1.6.0 for `@flagify/node` and `@flagify/react` via the `flagify-release` skill (tag push publishes)
- [ ] 4.3 After publish: `npm deprecate @flagify/node@1.5.0` and `@flagify/react@1.5.0` with message pointing to 1.6.0 and the new subpath

## 5. Follow-ups (cross-repo)

- [ ] 5.1 Decision log: write `Flagify Docs/decisions/2026-06-XX-node-webhooks-subpath-export.md` (with `## Decisiones clave` block) and update the index in `Flagify Docs/README.md`
- [ ] 5.2 Propose recording the policy "server-only additions to @flagify/node go behind subpath exports from day 1" in repo guidance (pending maintainer confirmation)
- [ ] 5.3 Notify downstream (vanguardhq) to remove the Metro crypto shim after upgrading to 1.6.0
