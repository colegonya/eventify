import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Tests that need a real Redis: the storage layer and the migration, run
// against the same local Upstash stand-in as the browser tests
// (`docker compose up -d`). Kept out of `npm test` so that stays runnable
// with nothing else started. CI runs these in the e2e job, which has Redis.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["test/integration/**/*.test.js"],
    // One database for every file, and each test empties it.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
