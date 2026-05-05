// Legacy endpoint — user creation is now handled by NextAuth PrismaAdapter
// (see packages/auth/src/nextauth-config.ts customAdapter.createUser).
// This endpoint is kept for backwards compatibility but requires authentication.

import { prisma } from "@healthcare/database";
import { NextResponse } from "next/server";
import { validateAuthToken, AuthError } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const authUser = await validateAuthToken(request);

    // Only return the authenticated user's own info
    const user = await prisma.user.findUnique({
      where: { email: authUser.email },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        doctorId: true,
        privacyConsentAt: true,
        sessionVersion: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error in /api/auth/user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
