import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@flagify/node": path.resolve(__dirname, "../node/src/index.ts"),
      "dotenv/config": path.resolve(__dirname, "./src/__tests__/dotenv-mock.ts"),
    },
  },
});
