import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig({
  test: {
    environment: "node"
  },
  resolve: {
    alias: {
      "@jinka-eg/types": fileURLToPath(new URL("../../packages/types/src/index.ts", import.meta.url)),
      "@jinka-eg/config": fileURLToPath(new URL("../../packages/config/src/index.ts", import.meta.url)),
      "@jinka-eg/fixtures": fileURLToPath(new URL("../../packages/fixtures/src/index.ts", import.meta.url)),
      "@jinka-eg/ui": fileURLToPath(new URL("../../packages/ui/src/index.ts", import.meta.url)),
      "~root": root
    }
  }
});
