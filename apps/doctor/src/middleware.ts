import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  console.log(`[DOCTOR MIDDLEWARE] Path: ${request.nextUrl.pathname}`);

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  console.log(`[DOCTOR MIDDLEWARE] Token:`, token ? `email=${token.email}, role=${token.role}` : 'null');

  const isLoginPage = request.nextUrl.pathname === "/login";
  const isAuthPage = request.nextUrl.pathname.startsWith("/api/auth");

  // Allow access to login and auth routes (no auth needed)
  if (isLoginPage || isAuthPage) {
    console.log(`[DOCTOR MIDDLEWARE] Allowing public route`);
    return NextResponse.next();
  }

  // Redirect to login if no token
  if (!token) {
    console.log(`[DOCTOR MIDDLEWARE] No token, redirecting to login`);
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Check if user has DOCTOR role
  // If user has a session but no role or wrong role, sign them out
  if (!token.role || token.role !== "DOCTOR") {
    console.log(`⚠️ [DOCTOR MIDDLEWARE] User ${token.email} has invalid role: ${token.role} - redirecting to signout`);

    // Redirect to signout to clear the invalid session
    const signOutUrl = new URL("/api/auth/signout", request.url);
    signOutUrl.searchParams.set("callbackUrl", "/login");
    return NextResponse.redirect(signOutUrl);
  }

  console.log(`[DOCTOR MIDDLEWARE] Access granted to ${token.email}`);
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Protect all routes except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
