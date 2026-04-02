import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PREFIXES = ["/login", "/api/auth", "/api/uploadthing"];

// Middleware runs on Edge runtime — Prisma cannot run here.
// We do a lightweight session cookie check only.
// Role check happens in AdminGuard (Node.js client component).
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const sessionCookie =
    request.cookies.get("__Secure-authjs.session-token") ||
    request.cookies.get("authjs.session-token");

  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
