import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PREFIXES = ["/login", "/api/auth", "/api/uploadthing"];

// Middleware runs on Edge runtime — Prisma cannot run here.
// We do a lightweight session cookie check only.
// Role and consent checks happen in the dashboard layout (Node.js).
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes through without auth check
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for NextAuth v5 database session cookie
  // Production uses __Secure- prefix (HTTPS), development does not
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
    // Protect all routes except static assets and PWA files
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.svg|apple-icon|api/pwa-icon).*)",
  ],
};
