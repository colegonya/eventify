import { kv } from "@/lib/kv";

// A shared passcode with no attempt limit is a free brute-force target. The
// deployment is a public URL with no per-user accounts, so this one passcode is
// the only thing between a stranger and the chapter's budget and contact list.
//
// A fixed window rather than a sliding log: one self-expiring counter per
// client turns unlimited guessing into a handful of tries per quarter hour,
// which is the whole point, and it needs no dependency beyond the Redis the
// deployment already has. @upstash/ratelimit would do this more precisely; it
// is not worth a new package for a single login form.
export const LOGIN_MAX_ATTEMPTS = 10;
export const LOGIN_WINDOW_SECONDS = 15 * 60;

const attemptsKey = (clientId) => `loginattempts:${clientId}`;

/**
 * The identifier a limit is counted against. Vercel sets x-forwarded-for to a
 * comma-separated chain with the real client first. Anything else — a direct
 * local request, a proxy that strips the header — falls back to one shared
 * bucket, which is stricter than having no limit, never looser.
 */
export function clientIdFromForwardedFor(headerValue) {
  const first = String(headerValue ?? "").split(",")[0].trim();
  return first || "unknown";
}

export async function isLoginLockedOut(clientId) {
  const count = Number(await kv.get(attemptsKey(clientId))) || 0;
  return count >= LOGIN_MAX_ATTEMPTS;
}

/** Counts one failed attempt and returns the running total for the window. */
export async function registerFailedLogin(clientId) {
  const key = attemptsKey(clientId);
  const count = await kv.incr(key);
  // Only the attempt that opens the window sets the expiry. Refreshing it on
  // every guess would let a steady stream of attempts hold the window open
  // forever, locking out the real officer long after the guessing stopped.
  if (count === 1) await kv.expire(key, LOGIN_WINDOW_SECONDS);
  return count;
}

/**
 * Clears the count on a correct passcode, so an officer who fat-fingers it a
 * few times before getting it right doesn't leave the next officer behind the
 * same campus NAT locked out.
 */
export async function clearFailedLogins(clientId) {
  await kv.del(attemptsKey(clientId));
}
