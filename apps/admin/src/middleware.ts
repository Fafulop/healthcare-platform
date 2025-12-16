import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isLoginPage = request.nextUrl.pathname === "/login";
  const isAuthPage = request.nextUrl.pathname.startsWith("/api/auth");
  const isUploadThingRoute = request.nextUrl.pathname.startsWith("/api/uploadthing");

  // Allow access to login, auth, and UploadThing webhook routes (no auth needed)
  if (isLoginPage || isAuthPage || isUploadThingRoute) {
    return NextResponse.next();
  }

  // Redirect to login if no token
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Check if user has ADMIN role
  if (token.role !== "ADMIN") {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "AccessDenied");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Protect all routes except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
