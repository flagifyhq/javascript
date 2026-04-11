# Flagify JavaScript SDK — CLAUDE.md

Instructions for AI assistants and contributors working on the Flagify JavaScript SDKs.

## Knowledge Graph (RAG index)

A graphify knowledge graph covers the full monorepo (API + CLI + SDKs + website). **Check it first for structural or cross-file questions** — ~186× cheaper than reading source and reveals how `@flagify/node` / `@flagify/react` / `@flagify/nestjs` / `@flagify/astro` tie into the Go API and the website docs.

**Location:** `../graphify-out/` — `graph.json` (1,671 nodes / 2,337 edges / 89 communities), `GRAPH_REPORT.md`, `graph.html`, `obsidian/` vault.

**Use it for:**
- `/graphify query "how does FlagifyProvider evaluate flags"` — ranked subgraph with `source_file:line`.
- `/graphify path "FlagifyProvider" "evaluation/handler.go"` — shortest path across the SDK → API boundary.
- `/graphify explain "RealtimeListener"` — plain-language summary of a node + its neighbors.

After code changes: `/graphify --update` from the monorepo root (incremental; AST is free, only doc/image changes cost LLM tokens).

Edges are tagged `EXTRACTED` / `INFERRED` / `AMBIGUOUS` — trust EXTRACTED, verify INFERRED against the referenced source location.

## Project overview

Monorepo with npm packages for integrating Flagify feature flags into JavaScript/TypeScript apps.

## Packages

| Package | Path | Description |
|---------|------|-------------|
| `@flagify/node` | `packages/node/` | Core SDK — flag evaluation, HTTP client, caching, streaming/polling |
| `@flagify/react` | `packages/react/` | React bindings — FlagifyProvider, useFlag, useVariant, useFlagValue hooks |
| `@flagify/nestjs` | `packages/nestjs/` | NestJS integration — module, service, guards, decorators for feature flags |
| `@flagify/astro` | `packages/astro/` | Astro integration — defineFlag, middleware, dev toolbar, Vercel Flags adapter |

## Key file locations

| What | Where |
|------|-------|
| Node SDK source | `packages/node/src/` |
| React SDK source | `packages/react/src/` |
| NestJS SDK source | `packages/nestjs/src/` |
| Astro SDK source | `packages/astro/src/` |
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
