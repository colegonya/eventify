import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  test: {
    // Pure logic in src/lib needs no DOM, and booting happy-dom for it costs
    // ~57s against 7ms of actual assertions. Component tests opt in per file
    // with a `// @vitest-environment happy-dom` comment at the top.
    environment: "node",
    globals: true,
    include: ["test/**/*.test.{js,jsx}"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
