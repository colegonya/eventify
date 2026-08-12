# Testing

100% test coverage is the goal. Tests are what make it safe to move quickly: they catch regressions before they ship, and they let you change code you did not write without rereading all of it.

## Running tests

```bash
npm test
```

Watch mode while you work:

```bash
npm run test:watch
```

## Framework

[Vitest](https://vitest.dev) 4, with `@vitejs/plugin-react` and Testing Library available for component tests. Config lives in `vitest.config.mjs`.

The default environment is `node`, because most of what's worth testing here is pure logic in `src/lib` that needs no DOM. Booting happy-dom for those costs ~57s against ~8ms of actual assertions. A test that needs a DOM opts in per file:

```js
// @vitest-environment happy-dom
```

The `@/` path alias resolves to `src/`, matching `jsconfig.json`.

## Layers

**Unit tests** (`test/lib/`) cover the pure logic: budget math, conflict detection, date handling, color contrast. This is where most value lives, since it's where the money and scheduling correctness are decided.

**Component tests** (`test/components/`) cover client components with Testing Library. Add `// @vitest-environment happy-dom` at the top of the file.

**Server Components** are not unit-testable today. Vitest cannot render async Server Components, which is most of `src/app`. Cover those through the browser instead.

**End-to-end** is not set up. If you add it later, Playwright is the usual companion to Vitest.

## Conventions

- Test files are `test/**/*.test.js`, mirroring the `src/` path they cover.
- Import through the `@/` alias, not relative paths.
- Test names state the behavior, not the function name. "nets revenue, applies the co-host share, and leaves excluded categories out of the total" beats "computeSemesterBudget works".
- Assert on real behavior. Never `expect(x).toBeDefined()`.
- Where a test pins current behavior that is expected to change, say so in a comment so the change stays deliberate. See the revenue-nets-actual case in `test/lib/budget.test.js`.
- Never import secrets or real credentials into a test. Use fixtures.

## What to test

Anything holding money, dates, or contrast decisions. `src/lib/budget.js` decides whether a chapter is over its cap. `src/lib/conflicts.js` decides whether two events collide. `src/lib/color.js` prevents white-on-white chips. Those earn tests before anything in the UI does.
