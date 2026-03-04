import { prisma } from "@healthcare/database";
import { NextResponse } from "next/server";

// Called by NextAuth jwt callback on every fresh Google OAuth sign-in.
// Saves the access/refresh tokens to the User row so calendar sync can use them.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, accessToken, refreshToken, expiresAt } = body;

    if (!email || !accessToken) {
      return NextResponse.json(
        { error: "email and accessToken are required" },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { email },
      data: {
        googleAccessToken: accessToken,
        // Only overwrite refreshToken if a new one was issued
        ...(refreshToken ? { googleRefreshToken: refreshToken } : {}),
        ...(expiresAt ? { googleTokenExpiry: new Date(expiresAt) } : {}),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in /api/auth/google-calendar/tokens:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
