import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

/**
 * Whether the current request carries a valid login cookie. Same comparison
 * the proxy makes, for code the proxy doesn't cover.
 */
export async function hasValidSession() {
  const cookie = (await cookies()).get(AUTH_COOKIE_NAME);
  return (await verifySessionToken(cookie?.value)).valid;
}

/**
 * The first line of every server action except login.
 *
 * The proxy alone isn't enough. It lets /login through without a cookie, and
 * Next.js will run any server action posted to any page, /login included. An
 * action ID is visible to anyone who has ever logged in on the current deploy,
 * so without this check a former officer could keep writing data, or set a new
 * passcode, after the chapter rotated theirs.
 */
export async function requireSession() {
  if (!(await hasValidSession())) redirect("/login");
}
