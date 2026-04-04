<p align="center">
  <a href="https://flagify.dev">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://flagify.dev/logo-white.svg" />
      <source media="(prefers-color-scheme: light)" srcset="https://flagify.dev/logo-color.svg" />
      <img alt="Flagify" src="https://flagify.dev/logo-color.svg" width="280" />
    </picture>
  </a>
</p>

<p align="center">
  <strong>JavaScript SDKs for Flagify</strong>
</p>

<p align="center">
  <a href="https://flagify.dev/docs">Documentation</a> &middot;
  <a href="https://github.com/flagifyhq/javascript/issues">Issues</a> &middot;
  <a href="https://flagify.dev">Website</a>
</p>

---

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [`@flagify/node`](./packages/node) | [![npm](https://img.shields.io/npm/v/@flagify/node?style=flat-square&color=0D80F9)](https://www.npmjs.com/package/@flagify/node) | Node.js SDK — TypeScript-first, in-memory cache, streaming sync |
| [`@flagify/react`](./packages/react) | [![npm](https://img.shields.io/npm/v/@flagify/react?style=flat-square&color=0D80F9)](https://www.npmjs.com/package/@flagify/react) | React SDK — hooks and provider |
| [`@flagify/nestjs`](./packages/nestjs) | [![npm](https://img.shields.io/npm/v/@flagify/nestjs?style=flat-square&color=0D80F9)](https://www.npmjs.com/package/@flagify/nestjs) | NestJS integration — module, service, guards, decorators |
| [`@flagify/astro`](./packages/astro) | [![npm](https://img.shields.io/npm/v/@flagify/astro?style=flat-square&color=0D80F9)](https://www.npmjs.com/package/@flagify/astro) | Astro integration — middleware, dev toolbar, Vercel Flags adapter |

## Getting started

```bash
# Node.js
pnpm add @flagify/node

# React
pnpm add @flagify/react

# NestJS
pnpm add @flagify/nestjs

# Astro
pnpm add @flagify/astro @flagify/node
```

See each package's README for usage instructions.

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Dev mode (watch)
pnpm run dev

# Regenerate barrel exports
pnpm run generate
```

## Structure

```
packages/
  node/     @flagify/node    — Core SDK with flag evaluation and caching
  react/    @flagify/react   — React hooks and context provider
  nestjs/   @flagify/nestjs  — NestJS module, service, guard, and decorators
  astro/    @flagify/astro   — Astro integration with dev toolbar and Vercel adapter
```

## License

MIT

---

<p align="center">
  <sub>Built with care by the <a href="https://flagify.dev">Flagify</a> team</sub>
</p>
