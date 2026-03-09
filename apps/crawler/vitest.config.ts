import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node"
  },
  resolve: {
    alias: {
      "@jinka-eg/types": fileURLToPath(new URL("../../packages/types/src/index.ts", import.meta.url)),
      "@jinka-eg/config": fileURLToPath(new URL("../../packages/config/src/index.ts", import.meta.url))
    }
  }
});
