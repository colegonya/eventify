"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_OPTIONS,
  createSessionToken,
  isValidPasscode,
} from "@/lib/auth";
import {
  clientIdFromForwardedFor,
  isLoginLockedOut,
  registerFailedLogin,
  clearFailedLogins,
} from "@/lib/rateLimit";
import { safeNextPath } from "@/lib/redirects";

// The one action that runs without a session, so it lives apart from
// actions.js. The login page imports only this file, which keeps every other
// action off the one page the proxy leaves open.
export async function loginAction(formData) {
  const passcode = String(formData.get("passcode") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const backToLogin = (error) => `/login?next=${encodeURIComponent(next)}&error=${error}`;

  // The passcode is shared and short by design, so the only thing standing
  // between a public URL and the chapter's data is how many guesses a stranger
  // gets. Check the limit before spending a Redis read on the passcode itself.
  const clientId = clientIdFromForwardedFor((await headers()).get("x-forwarded-for"));
  if (await isLoginLockedOut(clientId)) {
    redirect(backToLogin("locked"));
  }

  if (!(await isValidPasscode(passcode))) {
    await registerFailedLogin(clientId);
    redirect(backToLogin("1"));
  }

  await clearFailedLogins(clientId);

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, await createSessionToken(), AUTH_COOKIE_OPTIONS);

  redirect(next);
}
