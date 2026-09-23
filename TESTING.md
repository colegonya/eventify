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

With coverage, which is what CI runs:

```bash
npm run test:coverage
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

**Component tests** (`test/components/`) cover client components with Testing Library. Add `// @vitest-environment happy-dom` at the top of the file. Nothing lives here yet, which is a real gap: `EventForm.jsx` does budget math live as an officer types, with no test watching it.

**Server Components** are not unit-testable today. Vitest cannot render async Server Components, which is most of `src/app`. Cover those through the browser instead.

**End-to-end** tests (`e2e/`) drive a real browser through the app with [Playwright](https://playwright.dev). They cover what Vitest can't reach: Server Components, server actions, `data.js`, and the login gate.

They run against a production build (`next build && next start`), because some behavior only exists there: Next.js strips server error messages in production, for one. For the database, [serverless-redis-http](https://github.com/hiett/serverless-redis-http) stands in for Upstash. It speaks the same HTTP protocol in front of a plain Redis, so the app's real Upstash client runs unchanged and no Upstash account is needed.

To run them locally, you need Docker:

```bash
docker compose up -d        # local Redis + the Upstash stand-in, on port 8079
npx playwright install chromium   # once
npm run test:e2e            # builds the app, then runs the suite
```

Every run wipes the test database first. `e2e/support.mjs` refuses any Redis host that isn't local, so a misconfigured `E2E_REDIS_URL` fails instead of deleting real data.

How the suite is laid out:

- `first-run.setup.mjs` runs first: a wrong passcode, the right one, and first-run setup with example data. It saves the login for every other test.
- Tests run one at a time against one database. Each creates its own uniquely named data rather than relying on another test's.
- `desktop` runs at 1440×900 and `phone` at 375×812, both in Chromium.
- `accessibility.spec.mjs` runs axe on every page and attaches the results to the report. It is report-only for now and will become a hard failure once the known contrast issues are fixed.
- In CI, the `e2e` job runs alongside `check` and uploads the HTML report as the `playwright-report` artifact. Open it to see failure screenshots, traces, and axe results.

Add a test for a bug in the same change that fixes it. A test for a known, unfixed bug means either red CI or a skipped test, and this suite has neither.

## Conventions

- Test files are `test/**/*.test.js`, mirroring the `src/` path they cover.
- Import through the `@/` alias, not relative paths.
- Test names state the behavior, not the function name. "nets revenue, applies the co-host share, and leaves excluded categories out of the total" beats "computeSemesterBudget works".
- Assert on real behavior. Never `expect(x).toBeDefined()`.
- Where a test pins current behavior that is expected to change, say so in a comment so the change stays deliberate. See the revenue-nets-actual case in `test/lib/budget.test.js`.
- Never import secrets or real credentials into a test. Use fixtures.

## Coverage

CI runs `npm run test:coverage` and fails below the thresholds in `vitest.config.mjs`. Coverage is measured over `src/lib` only, and `data.js` and `actions.js` are excluded from even that: one is Redis calls and the other is `"use server"` orchestration, so a number including them would be dominated by code Vitest can't reach and the threshold would mean nothing. When logic inside either is worth pinning, move it to a plain module first — that's what `money.js` and `semesters.js` are.

The thresholds sit a few points under current coverage. They exist to catch a regression, not to be nudged up after every change.

## What to test

Anything holding money, dates, or contrast decisions. `src/lib/budget.js` decides whether a chapter is over its cap. `src/lib/conflicts.js` decides whether two events collide. `src/lib/color.js` prevents white-on-white chips. Those earn tests before anything in the UI does.
