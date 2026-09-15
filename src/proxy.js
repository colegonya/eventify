import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, expectedAuthCookieValue, secretsMatch } from "@/lib/auth";

export async function proxy(request) {
  const cookie = request.cookies.get(AUTH_COOKIE_NAME);
  // The cookie value is the credential itself here, so this comparison is
  // constant-time — see secretsMatch in auth.js.
  if (secretsMatch(cookie?.value, await expectedAuthCookieValue())) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
