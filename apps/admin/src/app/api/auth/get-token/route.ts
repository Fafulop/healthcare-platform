import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import jwt from "jsonwebtoken";

/**
 * Get JWT token for API authentication
 * NextAuth v5 uses encrypted session tokens (JWE), so we decode the session
 * and create a new signed JWT (not encrypted) for the API to verify
 */
export async function GET(request: NextRequest) {
  try {
    // Extract and decode NextAuth session (NOT raw - we need the decrypted payload)
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

    if (!secret) {
      return NextResponse.json(
        { error: "Server configuration error: secret not found" },
        { status: 500 }
      );
    }

    // Get the decrypted session payload (NOT raw)
    const session = await getToken({
      req: request as any,
      secret,
      raw: false, // Get decoded payload, not encrypted token
    });

    if (!session || !session.email) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Create a new signed JWT (not encrypted) for the API to verify
    const apiToken = jwt.sign(
      {
        email: session.email,
        sub: session.sub,
        name: session.name,
        picture: session.picture,
        userId: session.userId,
        role: session.role,
        doctorId: session.doctorId,
      },
      secret,
      {
        algorithm: 'HS256',
        expiresIn: '1h', // Token valid for 1 hour
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
