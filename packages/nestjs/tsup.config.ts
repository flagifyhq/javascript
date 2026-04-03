import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/testing/flagify-testing.module.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // Use SWC for decorator metadata support (esbuild doesn't support emitDecoratorMetadata)
  swc: true,
})
