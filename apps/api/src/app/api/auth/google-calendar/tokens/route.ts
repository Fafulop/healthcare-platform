// Legacy endpoint — Google OAuth tokens are now saved directly in the
// NextAuth signIn callback (see packages/auth/src/nextauth-config.ts).
// Kept for backwards compatibility but requires authentication.

import { prisma } from "@healthcare/database";
import { NextResponse } from "next/server";
import { validateAuthToken, AuthError } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const authUser = await validateAuthToken(request);

    const body = await request.json();
    const { accessToken, refreshToken, expiresAt } = body;

    if (!accessToken) {
      return NextResponse.json(
        { error: "accessToken is required" },
        { status: 400 }
      );
    }

    // Only allow updating the authenticated user's own tokens
    await prisma.user.update({
      where: { email: authUser.email },
      data: {
        googleAccessToken: accessToken,
        ...(refreshToken ? { googleRefreshToken: refreshToken } : {}),
        ...(expiresAt ? { googleTokenExpiry: new Date(expiresAt) } : {}),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error in /api/auth/google-calendar/tokens:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
