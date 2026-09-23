// Everything the app needs to boot for end-to-end tests. The defaults match
// docker-compose.yml and the CI workflow, so a plain `npm run test:e2e` works.
export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://127.0.0.1:${E2E_PORT}`;
export const E2E_PASSCODE = process.env.E2E_PASSCODE ?? "e2e-passcode";

export const E2E_SERVER_ENV = {
  SITE_PASSCODE: E2E_PASSCODE,
  UPSTASH_REDIS_REST_URL: process.env.E2E_REDIS_URL ?? "http://127.0.0.1:8079",
  UPSTASH_REDIS_REST_TOKEN: process.env.E2E_REDIS_TOKEN ?? "e2e-token",
  NEXT_TELEMETRY_DISABLED: "1",
};

export const AUTH_STATE_PATH = "e2e/.auth/officer.json";
