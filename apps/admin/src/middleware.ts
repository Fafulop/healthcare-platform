import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@healthcare/auth";

export async function middleware(request: NextRequest) {
  console.log(`[ADMIN MIDDLEWARE] Path: ${request.nextUrl.pathname}`);

  const isLoginPage = request.nextUrl.pathname === "/login";
  const isAuthPage = request.nextUrl.pathname.startsWith("/api/auth");
  const isUploadThingRoute = request.nextUrl.pathname.startsWith("/api/uploadthing");

  // Allow access to login, auth, and UploadThing webhook routes (no auth needed)
  if (isLoginPage || isAuthPage || isUploadThingRoute) {
    console.log(`[ADMIN MIDDLEWARE] Allowing public route`);
    return NextResponse.next();
  }

  const session = await auth();
  console.log(`[ADMIN MIDDLEWARE] Session:`, session?.user ? `email=${session.user.email}, role=${session.user.role}` : 'null');

  // Redirect to login if no session
  if (!session || !session.user) {
    console.log(`[ADMIN MIDDLEWARE] No session, redirecting to login`);
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Check if user has ADMIN role
  // If user has a session but no role or wrong role, sign them out
  if (!session.user.role || session.user.role !== "ADMIN") {
    console.log(`⚠️ [ADMIN MIDDLEWARE] User ${session.user.email} has invalid role: ${session.user.role} - redirecting to signout`);

    // Redirect to signout to clear the invalid session
    const signOutUrl = new URL("/api/auth/signout", request.url);
    signOutUrl.searchParams.set("callbackUrl", "/login");
    return NextResponse.redirect(signOutUrl);
  }

  console.log(`[ADMIN MIDDLEWARE] Access granted to ${session.user.email}`);
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Protect all routes except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
