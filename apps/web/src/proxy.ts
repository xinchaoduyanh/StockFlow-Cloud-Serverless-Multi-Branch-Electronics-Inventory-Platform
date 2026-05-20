import { NextRequest, NextResponse } from "next/server";
import { authCookieName, refreshCookieName } from "./lib/auth-token";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const accessToken = request.cookies.get(authCookieName)?.value;
  const refreshToken = request.cookies.get(refreshCookieName)?.value;
  const isAuthenticated = Boolean(accessToken || refreshToken);

  // 1. Nếu cố gắng truy cập dashboard mà chưa đăng nhập -> Đẩy về /login
  if (pathname.startsWith("/dashboard") && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Nếu đã đăng nhập mà truy cập trang login hoặc trang chủ -> Đẩy thẳng sang /dashboard
  if ((pathname === "/login" || pathname === "/") && isAuthenticated) {
    const dashboardUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/"],
};
