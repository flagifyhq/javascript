# Flagify JavaScript SDK — CLAUDE.md

Instructions for AI assistants and contributors working on the Flagify JavaScript SDKs.

## Project overview

Monorepo with two npm packages for integrating Flagify feature flags into JavaScript/TypeScript apps.

## Packages

| Package | Path | Description |
|---------|------|-------------|
| `@flagify/node` | `packages/node/` | Core SDK — flag evaluation, HTTP client, caching, streaming/polling |
| `@flagify/react` | `packages/react/` | React bindings — FlagifyProvider, useFlag, useVariant, useFlagValue hooks |

## Key file locations

| What | Where |
|------|-------|
| Node SDK source | `packages/node/src/` |
| React SDK source | `packages/react/src/` |
| Build config | `packages/*/tsup.config.ts` |
| Turbo config | `turbo.json` |
| Workspace config | `pnpm-workspace.yaml` |

## When changing the SDK

1. Update types/methods in the relevant package.
2. Run `pnpm run build` to verify compilation.
3. Run `pnpm run lint` for type checking.
4. Update website docs (`../apps/apps/website/src/content/docs/sdk/javascript.mdx` or `react.mdx`).

## Build & dev

```bash
pnpm install    # install deps
pnpm run build  # build all packages
pnpm run dev    # watch mode
pnpm run lint   # type check
pnpm run clean  # clean build artifacts
```

## Cross-repo sync

- If the **evaluation API** changes (`../api/`), update the HTTP client and types in `@flagify/node`.
- If SDK features change, update **website docs** (`../apps/apps/website/src/content/docs/sdk/`).
