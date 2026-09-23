import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHash } from "crypto";

// auth.js keeps the passcode and the session signing key in Redis, which
// Redis.fromEnv() would refuse to construct without real credentials. This
// fake covers the commands auth.js uses.
const { store } = vi.hoisted(() => ({ store: new Map() }));

vi.mock("@/lib/kv", () => ({
  kv: {
    get: async (key) => store.get(key) ?? null,
    mget: async (...keys) => keys.map((key) => store.get(key) ?? null),
    set: async (key, value, options) => {
      if (options?.nx && store.has(key)) return null;
      store.set(key, value);
      return "OK";
    },
    del: async (...keys) => keys.filter((key) => store.delete(key)).length,
  },
}));

// Set before the import: auth.js throws at module load without it, on purpose.
process.env.SITE_PASSCODE = "env-passcode";

const { secretsMatch, isValidPasscode, setPasscode, createSessionToken, verifySessionToken } =
  await import("@/lib/auth");

const sha256Hex = (value) => createHash("sha256").update(value).digest("hex");
const DAY = 24 * 60 * 60;
const NOW = 1_800_000_000;

beforeEach(() => {
  // Keep the signing key across tests, like a real deployment; clear the rest.
  for (const key of [...store.keys()]) if (key !== "authSessionKey") store.delete(key);
});

describe("secretsMatch", () => {
  it("accepts identical values and rejects values differing in one character", () => {
    const digest = sha256Hex("hunter2");
    const nearMiss = digest.slice(0, -1) + (digest.endsWith("a") ? "b" : "a");
    expect(secretsMatch(digest, digest)).toBe(true);
    expect(secretsMatch(digest, nearMiss)).toBe(false);
  });

  it("rejects values of a different length, and missing values, without throwing", () => {
    expect(secretsMatch("short", sha256Hex("hunter2"))).toBe(false);
    expect(secretsMatch(undefined, sha256Hex("hunter2"))).toBe(false);
  });
});

describe("isValidPasscode", () => {
  it("uses SITE_PASSCODE until the chapter sets its own", async () => {
    expect(await isValidPasscode("env-passcode")).toBe(true);
    expect(await isValidPasscode("wrong")).toBe(false);
  });

  it("uses the Settings passcode once one is set, and stops accepting SITE_PASSCODE", async () => {
    await setPasscode("new-shared-code");
    expect(await isValidPasscode("new-shared-code")).toBe(true);
    expect(await isValidPasscode("env-passcode")).toBe(false);
  });

  it("stores an scrypt hash, never the passcode or a plain SHA-256 of it", async () => {
    await setPasscode("new-shared-code");
    const record = store.get("authPasscode");
    expect(record.hash).toMatch(/^scrypt\$/);
    expect(JSON.stringify(record)).not.toContain("new-shared-code");
    expect(JSON.stringify(record)).not.toContain(sha256Hex("new-shared-code"));
  });

  it("upgrades a legacy SHA-256 passcode to scrypt on the first correct login", async () => {
    store.set("authPasscodeHash", sha256Hex("legacy-code"));

    expect(await isValidPasscode("wrong")).toBe(false);
    expect(store.has("authPasscodeHash")).toBe(true);
    expect(store.has("authPasscode")).toBe(false);

    expect(await isValidPasscode("legacy-code")).toBe(true);
    expect(store.has("authPasscodeHash")).toBe(false);
    expect(store.get("authPasscode").hash).toMatch(/^scrypt\$/);
    expect(await isValidPasscode("legacy-code")).toBe(true);
    expect(await isValidPasscode("env-passcode")).toBe(false);
  });
});

describe("sessions", () => {
  it("accepts a fresh session, and rejects no cookie or a legacy cookie", async () => {
    const token = await createSessionToken(NOW);
    expect(await verifySessionToken(token, NOW + 60)).toEqual({ valid: true, renewed: null });
    expect((await verifySessionToken(undefined, NOW)).valid).toBe(false);
    expect((await verifySessionToken(sha256Hex("env-passcode"), NOW)).valid).toBe(false);
  });

  it("never puts the passcode or its hash in the cookie", async () => {
    const token = await createSessionToken(NOW);
    const readable = Buffer.from(token.split(".")[0], "base64url").toString();
    expect(readable).not.toContain("env-passcode");
    expect(readable).not.toContain(sha256Hex("env-passcode"));
  });

  it("signs out every session issued before a passcode change", async () => {
    const before = await createSessionToken(NOW);
    await setPasscode("rotated-code");
    expect((await verifySessionToken(before, NOW + 60)).valid).toBe(false);

    const after = await createSessionToken(NOW + 60);
    expect((await verifySessionToken(after, NOW + 120)).valid).toBe(true);

    await setPasscode("rotated-again");
    expect((await verifySessionToken(after, NOW + 180)).valid).toBe(false);
  });

  it("ends a session unused for 30 days", async () => {
    const token = await createSessionToken(NOW);
    expect((await verifySessionToken(token, NOW + 30 * DAY - 1)).valid).toBe(true);
    expect((await verifySessionToken(token, NOW + 30 * DAY)).valid).toBe(false);
  });

  it("extends a session in use by 30 days, at most once a day", async () => {
    const token = await createSessionToken(NOW);
    expect((await verifySessionToken(token, NOW + DAY - 1)).renewed).toBeNull();

    const { valid, renewed } = await verifySessionToken(token, NOW + 29 * DAY);
    expect(valid).toBe(true);
    expect(renewed).toEqual(expect.any(String));
    // The renewed token outlives the original's expiry.
    expect((await verifySessionToken(renewed, NOW + 50 * DAY)).valid).toBe(true);
    expect((await verifySessionToken(token, NOW + 50 * DAY)).valid).toBe(false);
  });

  it("treats the legacy-to-scrypt upgrade as a passcode change", async () => {
    store.set("authPasscodeHash", sha256Hex("legacy-code"));
    const underLegacy = await createSessionToken(NOW);
    expect((await verifySessionToken(underLegacy, NOW + 60)).valid).toBe(true);

    // The upgrade is a new passcode version; the officer logging in gets a
    // new session, and nobody else could hold a valid one under the old
    // version since the upgrade runs at the first login after deploy.
    await isValidPasscode("legacy-code");
    expect((await verifySessionToken(underLegacy, NOW + 120)).valid).toBe(false);
  });
});
