// Legacy endpoint — user creation is now handled by NextAuth PrismaAdapter
// (see packages/auth/src/nextauth-config.ts customAdapter.createUser).
// This endpoint returns the authenticated user's own info.

import { prisma } from "@healthcare/database";
import { auth } from "@healthcare/auth";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        doctorId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error in /api/auth/user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
