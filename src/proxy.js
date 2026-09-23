import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS, verifySessionToken } from "@/lib/auth";

export async function proxy(request) {
  const session = await verifySessionToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);
  if (session.valid) {
    const response = NextResponse.next();
    // A session in use gets another 30 days, once a day at most.
    if (session.renewed) response.cookies.set(AUTH_COOKIE_NAME, session.renewed, AUTH_COOKIE_OPTIONS);
    return response;
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
