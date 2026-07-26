import { createHash } from "crypto";
import { kv } from "@/lib/kv";

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
const PASSCODE_KEY = "authPasscodeHash";

/** Short enough to share in a group chat, long enough not to be guessed. */
export const MIN_PASSCODE_LENGTH = 6;

export function hashPasscode(passcode) {
  return createHash("sha256").update(passcode).digest("hex");
}

const ENV_PASSCODE_HASH = hashPasscode(PASSCODE);

/**
 * The value an auth cookie has to match: whatever the chapter last saved,
 * falling back to SITE_PASSCODE until they rotate it.
 *
 * Deliberately uncached, unlike the rest of the app's Redis reads. The proxy
 * and the server actions run as separate module instances, so an in-process
 * cache here doesn't just delay a rotation — it inverts it: the proxy would
 * keep honoring cookies minted from the old passcode while rejecting the new
 * one, including the cookie just handed to the officer who rotated. Auth is the
 * one place where being a round trip slower beats being briefly wrong.
 */
export async function currentPasscodeHash() {
  const stored = await kv.get(PASSCODE_KEY);
  return typeof stored === "string" && stored ? stored : ENV_PASSCODE_HASH;
}

export async function expectedAuthCookieValue() {
  return currentPasscodeHash();
}

export async function isValidPasscode(input) {
  return hashPasscode(input) === (await currentPasscodeHash());
}

export async function setPasscode(passcode) {
  const value = hashPasscode(passcode);
  await kv.set(PASSCODE_KEY, value);
  return value;
}
