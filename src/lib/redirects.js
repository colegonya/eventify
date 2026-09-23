const PLACEHOLDER_ORIGIN = "http://same-site.invalid";

/**
 * Turns the login form's `next` value into a path on this site, or the
 * fallback. `next` arrives from the URL, so without this a link like
 * /login?next=https://evil.example sends an officer off-site right after they
 * type the real passcode. Resolving against a placeholder origin catches every
 * spelling a browser treats as another host: //evil.example, /\evil.example,
 * and absolute URLs.
 */
export function safeNextPath(next, fallback = "/calendar") {
  if (typeof next !== "string" || !next.startsWith("/") || next.includes("\\")) return fallback;
  let url;
  try {
    url = new URL(next, PLACEHOLDER_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
