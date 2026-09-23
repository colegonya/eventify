import { randomBytes, scrypt, timingSafeEqual } from "crypto";

// scrypt is deliberately slow and memory-hungry, so a leaked hash can't be
// brute-forced the way a plain SHA-256 can: one gaming GPU runs about 22
// billion SHA-256 guesses a second, enough to exhaust every 8-character
// lowercase-and-digit passcode in about two minutes. These are the OWASP
// minimums for scrypt, costing roughly 50-100ms per check.
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
// scrypt needs 128 * N * r bytes; Node's default cap is 32MB, exactly that.
const MAX_MEMORY = 64 * 1024 * 1024;

function derive(passcode, salt, n, r, p, keyLength) {
  return new Promise((resolve, reject) => {
    scrypt(passcode, salt, keyLength, { N: n, r, p, maxmem: MAX_MEMORY }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

/**
 * Hashes a passcode for storage, as `scrypt$N$r$p$salt$key`. The parameters
 * travel with the hash, so raising them later doesn't strand old hashes.
 */
export async function hashPasscode(passcode) {
  const salt = randomBytes(16);
  const key = await derive(String(passcode), salt, N, R, P, KEY_LENGTH);
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

/** Whether `passcode` matches a hash from hashPasscode. False for anything malformed. */
export async function verifyPasscodeHash(passcode, stored) {
  const parts = typeof stored === "string" ? stored.split("$") : [];
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [n, r, p] = parts.slice(1, 4).map(Number);
  if (![n, r, p].every(Number.isSafeInteger)) return false;
  const salt = Buffer.from(parts[4], "base64url");
  const expected = Buffer.from(parts[5], "base64url");
  if (salt.length === 0 || expected.length === 0) return false;
  try {
    const actual = await derive(String(passcode), salt, n, r, p, expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
