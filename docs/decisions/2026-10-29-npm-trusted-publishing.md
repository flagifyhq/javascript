# npm trusted publishing for JavaScript SDKs

- Fecha: 2026-10-29
- Autor: Codex
- Origen: Mario requested the same OIDC publishing used by the CLI for the libraries.
- Alcance: @flagify/node, @flagify/react, @flagify/nestjs, @flagify/astro
- Estado tests: Node 24: frozen install, build, lint, all 142 tests and packing of all four packages passed. Tarball manifests contain resolved internal dependencies. GitHub CI pending.

## Decisiones clave (para codex review)

- Bind each npm package to flagifyhq/javascript and release.yml. Keep the existing tag-triggered release and the build/test gate; no new library version is published by this change.
- Use Node 24 and npm 11 with id-token: write scoped to the publish job, removing NPM_TOKEN. npm exchanges the workflow identity for short-lived publication access.
- Pack with pnpm before publishing tarballs with npm. This preserves workspace dependency conversion while explicitly using the npm client that supports OIDC. Publish node before its dependent integrations.
- Configure npm package connections before using the workflow. The first publication validates each connection; npm may expire unused pending connections.

## Validation

Run frozen dependency installation, build, lint and tests, then pack all packages and inspect tarball manifests for resolved internal dependencies. No registry publication is part of validation.

## References

- https://docs.npmjs.com/trusted-publishers/
- https://pnpm.io/cli/pack
