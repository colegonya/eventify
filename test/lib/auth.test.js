import { describe, it, expect, beforeEach, vi } from "vitest";

// auth.js reads the stored passcode hash through the Redis client, which
// Redis.fromEnv() would refuse to construct without real credentials. The fake
// stands in for the one key auth.js touches.
const { stored } = vi.hoisted(() => ({ stored: { value: null } }));

vi.mock("@/lib/kv", () => ({
  kv: {
    get: async () => stored.value,
    set: async (_key, value) => {
      stored.value = value;
    },
  },
}));

// Set before the import: auth.js throws at module load without it, on purpose.
process.env.SITE_PASSCODE = "env-passcode";

const { hashPasscode, secretsMatch, isValidPasscode, setPasscode } = await import("@/lib/auth");

beforeEach(() => {
  stored.value = null;
});

describe("secretsMatch", () => {
  it("accepts identical values and rejects values differing in one character", () => {
    const digest = hashPasscode("hunter2");
    const nearMiss = digest.slice(0, -1) + (digest.endsWith("a") ? "b" : "a");

    expect(secretsMatch(digest, digest)).toBe(true);
    expect(secretsMatch(digest, nearMiss)).toBe(false);
  });

  it("rejects a length mismatch instead of throwing", () => {
    // timingSafeEqual throws on unequal buffer lengths, and the cookie value is
    // attacker-controlled, so an arbitrary-length value has to be handled here
    // rather than taking down the proxy that every request passes through.
    expect(secretsMatch("short", hashPasscode("hunter2"))).toBe(false);
    expect(secretsMatch(undefined, hashPasscode("hunter2"))).toBe(false);
    expect(secretsMatch(null, null)).toBe(true);
  });
});

describe("isValidPasscode", () => {
  it("falls back to the env passcode until a chapter rotates it", async () => {
    expect(await isValidPasscode("env-passcode")).toBe(true);
    expect(await isValidPasscode("wrong")).toBe(false);
  });

  it("honors the rotated passcode and stops accepting the env one", async () => {
    await setPasscode("new-shared-code");

    expect(await isValidPasscode("new-shared-code")).toBe(true);
    // The env var is the *initial* value only. Once rotated it must stop
    // working, or a leaked deploy-time passcode would never truly be revoked.
    expect(await isValidPasscode("env-passcode")).toBe(false);
  });
});
