import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
// A session in use gets a fresh 30 days, at most once a day, so an officer
// who opens the app weekly never gets signed out, and one who stops using it
// does after a month.
export const SESSION_RENEW_AFTER_SECONDS = 24 * 60 * 60;

const sign = (body, key) => createHmac("sha256", key).update(body).digest();

/**
 * A signed, self-contained session: `base64url(claims).base64url(hmac)`.
 * Claims are readable by anyone holding the cookie, so they never include
 * anything secret; the signature is what makes them trustworthy.
 */
export function signSessionToken(claims, key) {
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${body}.${sign(body, key).toString("base64url")}`;
}

/**
 * The claims of a token this key signed and that hasn't expired, or null for
 * anything else: missing, malformed, tampered with, signed by another key, or
 * past `exp`.
 */
export function readSessionToken(token, key, nowSeconds) {
  if (typeof token !== "string") return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;

  const expected = sign(body, key);
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  let claims;
  try {
    claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!claims || typeof claims.exp !== "number" || claims.exp <= nowSeconds) return null;
  return claims;
}
