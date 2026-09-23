import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { kv } from "@/lib/kv";
import { hashPasscode, verifyPasscodeHash } from "@/lib/passcodeHash";
import {
  SESSION_RENEW_AFTER_SECONDS,
  SESSION_TTL_SECONDS,
  readSessionToken,
  signSessionToken,
} from "@/lib/sessionToken";

const PASSCODE = process.env.SITE_PASSCODE;

// No guessable fallback — a template with a hardcoded default password is
// exactly the mistake this app used to make. Fail at startup instead. This is
// only the *initial* passcode: once a chapter rotates it from the Settings
// page, the stored hash wins and this value stops being consulted.
if (!PASSCODE) {
  throw new Error(
    "SITE_PASSCODE environment variable is not set. Set it in .env.local " +
      "(or your deployment's environment variables) before starting the app — see README.md.",
  );
}

export const AUTH_COOKIE_NAME = "social_calendar_access";

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};

/** Short enough to share in a group chat, long enough not to be guessed. */
export const MIN_PASSCODE_LENGTH = 6;

// { hash: scrypt string, version: n }, written when a chapter sets a passcode
// in Settings. `version` goes up by one on every change, and every session
// records the version it was issued under, so a change signs out every other
// browser.
const PASSCODE_KEY = "authPasscode";
// The unsalted SHA-256 hex digest earlier versions stored. Upgraded to
// PASSCODE_KEY on the first correct login after this deploys, then deleted.
const LEGACY_PASSCODE_KEY = "authPasscodeHash";
// { key: base64url } — the HMAC key that signs session cookies. Generated on
// first use, so no deployment has to add an environment variable for it.
const SESSION_KEY_KEY = "authSessionKey";

const sha256Hex = (value) => createHash("sha256").update(String(value)).digest("hex");

/**
 * Constant-time string comparison. Plain `===` bails at the first differing
 * character, so how long it takes to say "no" leaks how much of the value was
 * right. A length mismatch returns early and leaks only length, which is not
 * a secret: both sides here are always 64-character SHA-256 digests.
 */
export function secretsMatch(a, b) {
  const left = Buffer.from(String(a ?? ""), "utf8");
  const right = Buffer.from(String(b ?? ""), "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

let sessionKey = null;

/**
 * The key session cookies are signed with, created once per deployment. SET
 * NX makes two cold instances racing to create it agree on one key. Cached in
 * memory because it never changes; if it's ever deleted from Redis, a new one
 * is made and every session ends, which is the right outcome.
 */
async function getSessionKey() {
  if (sessionKey) return sessionKey;
  await kv.set(SESSION_KEY_KEY, { key: randomBytes(32).toString("base64url") }, { nx: true });
  const stored = await kv.get(SESSION_KEY_KEY);
  if (typeof stored?.key !== "string") throw new Error("Session signing key is missing from the database.");
  sessionKey = Buffer.from(stored.key, "base64url");
  return sessionKey;
}

/**
 * Which passcode is current, as a short label a session can record. Read
 * fresh on every request, never cached: the proxy and the server actions run
 * as separate module instances, and a cached value in either would keep
 * honoring sessions from a passcode the chapter just replaced.
 *
 * Labels for the unrotated cases are HMACs, never the passcode's own hash,
 * because session claims are readable by whoever holds the cookie.
 */
async function currentPasscodeVersion(key) {
  const [record, legacy] = await kv.mget(PASSCODE_KEY, LEGACY_PASSCODE_KEY);
  if (Number.isSafeInteger(record?.version)) return `v${record.version}`;
  const label = (source) => createHmac("sha256", key).update(source).digest("base64url").slice(0, 22);
  if (typeof legacy === "string" && legacy) return `legacy:${label(legacy)}`;
  return `env:${label(PASSCODE)}`;
}

async function writePasscode(passcode, version) {
  await kv.set(PASSCODE_KEY, { hash: await hashPasscode(passcode), version });
  await kv.del(LEGACY_PASSCODE_KEY);
}

/**
 * Checks a login attempt against, in order: the passcode set in Settings, the
 * legacy SHA-256 one (upgraded to scrypt when it matches), or SITE_PASSCODE.
 */
export async function isValidPasscode(input) {
  const [record, legacy] = await kv.mget(PASSCODE_KEY, LEGACY_PASSCODE_KEY);
  if (typeof record?.hash === "string") return verifyPasscodeHash(input, record.hash);

  if (typeof legacy === "string" && legacy) {
    if (!secretsMatch(sha256Hex(input), legacy)) return false;
    await writePasscode(input, 1);
    return true;
  }

  return secretsMatch(sha256Hex(input), sha256Hex(PASSCODE));
}

/** Replaces the passcode. Every session issued before this stops working. */
export async function setPasscode(passcode) {
  const record = await kv.get(PASSCODE_KEY);
  const version = Number.isSafeInteger(record?.version) ? record.version + 1 : 1;
  await writePasscode(passcode, version);
}

/** A new session cookie value for whoever just proved they know the passcode. */
export async function createSessionToken(nowSeconds = Math.floor(Date.now() / 1000)) {
  const key = await getSessionKey();
  const pv = await currentPasscodeVersion(key);
  return signSessionToken({ pv, iat: nowSeconds, exp: nowSeconds + SESSION_TTL_SECONDS }, key);
}

/**
 * Whether a cookie value is a live session: signed by this deployment,
 * unexpired, and issued under the current passcode. `renewed` is a fresh
 * token when the session is due for its daily extension, otherwise null.
 */
export async function verifySessionToken(token, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!token) return { valid: false, renewed: null };
  const key = await getSessionKey();
  const claims = readSessionToken(token, key, nowSeconds);
  if (!claims || claims.pv !== (await currentPasscodeVersion(key))) {
    return { valid: false, renewed: null };
  }
  const dueForRenewal = nowSeconds - claims.iat >= SESSION_RENEW_AFTER_SECONDS;
  return {
    valid: true,
    renewed: dueForRenewal
      ? signSessionToken({ pv: claims.pv, iat: nowSeconds, exp: nowSeconds + SESSION_TTL_SECONDS }, key)
      : null,
  };
}
