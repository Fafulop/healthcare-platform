import { NextRequest, NextResponse } from "next/server";
import { auth } from "@healthcare/auth";
import jwt from "jsonwebtoken";

/**
 * Get JWT token for API authentication
 * Uses NextAuth v5 auth() to get session, then creates a signed JWT for the API
 */
export async function GET(request: NextRequest) {
  try {
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

    if (!secret) {
      return NextResponse.json(
        { error: "Server configuration error: secret not found" },
        { status: 500 }
      );
    }

    // Get session using NextAuth v5 auth()
    const session = await auth();

    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const user = session.user as any;

    // Create a new signed JWT (not encrypted) for the API to verify
    const apiToken = jwt.sign(
      {
        email: user.email,
        sub: user.id,
        name: user.name,
        picture: user.image,
        userId: user.id,
        role: user.role,
        doctorId: user.doctorId,
      },
      secret,
      {
        algorithm: 'HS256',
        expiresIn: '1h',
      }
    );

    return NextResponse.json({ token: apiToken });
  } catch (error) {
    console.error("Error getting token:", error);
    return NextResponse.json(
      { error: "Failed to get authentication token" },
      { status: 500 }
    );
  }
}
