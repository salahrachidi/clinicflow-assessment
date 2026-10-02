import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./src/test/setup.ts"],
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 15_000
  }
});
