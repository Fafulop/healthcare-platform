import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@healthcare/auth";

export async function middleware(request: NextRequest) {
  console.log(`[DOCTOR MIDDLEWARE] Path: ${request.nextUrl.pathname}`);

  const isLoginPage = request.nextUrl.pathname === "/login";
  const isConsentPage = request.nextUrl.pathname === "/consent";
  const isAuthPage = request.nextUrl.pathname.startsWith("/api/auth");
  const isUploadThingRoute = request.nextUrl.pathname.startsWith("/api/uploadthing");

  // Allow access to login, auth, and UploadThing routes (no auth needed)
  if (isLoginPage || isAuthPage || isUploadThingRoute) {
    console.log(`[DOCTOR MIDDLEWARE] Allowing public route`);
    return NextResponse.next();
  }

  const session = await auth();
  console.log(`[DOCTOR MIDDLEWARE] Session:`, session?.user ? `email=${session.user.email}, role=${session.user.role}` : 'null');

  // Redirect to login if no session
  if (!session || !session.user) {
    console.log(`[DOCTOR MIDDLEWARE] No session, redirecting to login`);
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Check if user has DOCTOR or ADMIN role
  // Admins can access doctor portal for testing/support
  // If user has a session but no role or wrong role, sign them out
  const allowedRoles = ["DOCTOR", "ADMIN"];
  if (!session.user.role || !allowedRoles.includes(session.user.role)) {
    console.log(`⚠️ [DOCTOR MIDDLEWARE] User ${session.user.email} has invalid role: ${session.user.role} - redirecting to signout`);

    // Redirect to signout to clear the invalid session
    const signOutUrl = new URL("/api/auth/signout", request.url);
    signOutUrl.searchParams.set("callbackUrl", "/login");
    return NextResponse.redirect(signOutUrl);
  }

  // Redirect to consent page if doctor hasn't accepted privacy policy.
  // Allow through if already on /consent (prevents redirect loop).
  if (session.user.privacyConsentAt == null && !isConsentPage) {
    console.log(`[DOCTOR MIDDLEWARE] User ${session.user.email} has not accepted privacy policy — redirecting to /consent`);
    const consentUrl = new URL("/consent", request.url);
    return NextResponse.redirect(consentUrl);
  }

  console.log(`[DOCTOR MIDDLEWARE] Access granted to ${session.user.email}`);
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Protect all routes except static assets and PWA files
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.svg|apple-icon|api/pwa-icon).*)",
  ],
};
