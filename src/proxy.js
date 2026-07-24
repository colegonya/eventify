import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, expectedAuthCookieValue } from "@/lib/auth";

export function proxy(request) {
  const cookie = request.cookies.get(AUTH_COOKIE_NAME);
  if (cookie?.value === expectedAuthCookieValue()) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
