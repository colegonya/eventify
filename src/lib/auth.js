import { createHash } from "crypto";

const PASSCODE = process.env.SITE_PASSCODE;

// No guessable fallback — a template with a hardcoded default password is
// exactly the mistake this app used to make. Fail at startup instead.
if (!PASSCODE) {
  throw new Error(
    "SITE_PASSCODE environment variable is not set. Set it in .env.local " +
      "(or your deployment's environment variables) before starting the app — see README.md.",
  );
}

export const AUTH_COOKIE_NAME = "social_calendar_access";

// Stored in the cookie instead of the raw passcode, so the cookie itself
// doesn't hand out the passcode to anyone who inspects their own browser.
// Computed once at module load (PASSCODE is fixed for the process lifetime)
// instead of re-hashing on every proxy.ts middleware invocation.
const EXPECTED_COOKIE_VALUE = createHash("sha256").update(PASSCODE).digest("hex");

export function expectedAuthCookieValue() {
  return EXPECTED_COOKIE_VALUE;
}

export function isValidPasscode(input) {
  return input === PASSCODE;
}
