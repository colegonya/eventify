import { Redis } from "@upstash/redis";
import { readFileSync } from "node:fs";
import { AxeBuilder } from "@axe-core/playwright";
import { E2E_SERVER_ENV } from "./env.mjs";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "srh"]);

/**
 * A Redis client for the test database, and only the test database. The
 * suite wipes it before every run, so this refuses any host that isn't local:
 * pointing E2E_REDIS_URL at a real Upstash instance by mistake must fail
 * loudly instead of deleting a chapter's semester.
 */
export function testRedis() {
  const url = E2E_SERVER_ENV.UPSTASH_REDIS_REST_URL;
  const { hostname } = new URL(url);
  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(`Refusing to use ${url} for end-to-end tests: only a local Redis is allowed.`);
  }
  return new Redis({ url, token: E2E_SERVER_ENV.UPSTASH_REDIS_REST_TOKEN });
}

/** YYYY-MM-DD, `days` from today (UTC, matching the server). */
export function isoDaysFromToday(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** A name no other test run will collide with. */
export function uniqueName(prefix) {
  return `${prefix} ${Date.now().toString(36)}`;
}

/** The server action ID for an export, read from the build the server is running. */
export function serverActionId(exportedName) {
  const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8"));
  const entry = Object.entries(manifest.node).find(([, v]) => v.exportedName === exportedName);
  if (!entry) throw new Error(`No server action named ${exportedName} in this build`);
  return entry[0];
}

/**
 * Runs axe on the current page and attaches the violations to the report.
 * Report-only for now: the audit found contrast failures that would make this
 * red today. It becomes a hard gate once those are fixed.
 */
export async function recordAccessibility(page, testInfo, label) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  await testInfo.attach(`axe-${label}.json`, {
    body: JSON.stringify(violations, null, 2),
    contentType: "application/json",
  });
  testInfo.annotations.push({
    type: "axe",
    description: `${label}: ${violations.length} rule(s) violated${
      violations.length ? ` (${violations.map((v) => v.id).join(", ")})` : ""
    }`,
  });
}
