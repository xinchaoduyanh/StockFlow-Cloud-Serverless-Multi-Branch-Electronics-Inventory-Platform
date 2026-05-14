import { NextRequest, NextResponse } from "next/server";
import { authCookieName } from "./lib/auth-token";

export function proxy(request: NextRequest) {
  const token = request.cookies.get(authCookieName)?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
