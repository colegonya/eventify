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
    coverage: {
      provider: "v8",
      // Only src/lib. TESTING.md is explicit that this is where the value is:
      // budget math, conflict detection, dates, money. Measuring src/app and
      // src/components too would report a number dominated by Server
      // Components Vitest cannot render, which makes the figure meaningless
      // and the threshold unenforceable.
      include: ["src/lib/**"],
      exclude: [
        // The I/O boundaries. data.js is Redis calls and actions.js is
        // "use server" orchestration; both are covered in the browser, per
        // TESTING.md. The logic worth pinning has been pulled out of them
        // into money.js and semesters.js, which are measured below.
        "src/lib/data.js",
        "src/lib/actions.js",
        // Constants, env-var defaults, and a three-line redirect wrapper:
        // nothing here has a branch to get wrong.
        "src/lib/kv.js",
        "src/lib/constants.js",
        "src/lib/seed.js",
        "src/lib/config.js",
        "src/lib/contactStatusColors.js",
        "src/lib/setup.js",
      ],
      reporter: ["text-summary", "lcov"],
      // Set just under what the suite covers today, so a regression fails CI
      // but an ordinary change doesn't trip on a rounding difference.
      thresholds: { lines: 85, functions: 85, branches: 75, statements: 85 },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
