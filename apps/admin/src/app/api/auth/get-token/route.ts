import { NextRequest, NextResponse } from "next/server";
import { auth } from "@healthcare/auth";
import jwt from "jsonwebtoken";

/**
 * Get JWT token for API authentication
 * Creates a signed JWT token from the NextAuth session for API authentication
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

    // Get session using the same auth() function as middleware
    const session = await auth();

    console.log('[GET-TOKEN] Session from auth():', session ? 'Found' : 'NULL');
    console.log('[GET-TOKEN] User email:', session?.user?.email);
    console.log('[GET-TOKEN] User doctorId:', session?.user?.doctorId);

    if (!session || !session.user || !session.user.email) {
      console.error('[GET-TOKEN] Session or user missing - returning 401');
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Create a new signed JWT (not encrypted) for the API to verify
    const apiToken = jwt.sign(
      {
        email: session.user.email,
        sub: session.user.id,
        name: session.user.name,
        picture: session.user.image,
        userId: session.user.id,
        role: session.user.role,
        doctorId: session.user.doctorId,
      },
      secret,
      {
        algorithm: 'HS256',
        expiresIn: '1h', // Token valid for 1 hour
      }
    );

    console.log('[GET-TOKEN] Created API token for:', session.user.email);
    return NextResponse.json({ token: apiToken });
  } catch (error) {
    console.error("Error getting token:", error);
    return NextResponse.json(
      { error: "Failed to get authentication token" },
      { status: 500 }
    );
  }
}
