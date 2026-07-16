import { NextRequest, NextResponse } from "next/server";
import { auth } from "@healthcare/auth";
import { mintApiToken } from "@/lib/agenda-agent/api-token";

/**
 * Get JWT token for API authentication
 * Uses NextAuth v5 auth() to get session, then mints the shared apps/api token
 * (see lib/agenda-agent/api-token.ts — the ONE definition of its claims).
 */
export async function GET(request: NextRequest) {
  try {
    // Get session using NextAuth v5 auth()
    const session = await auth();

    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const user = session.user as any;

    const apiToken = mintApiToken({
      email: user.email,
      userId: user.id,
      sessionVersion: user.sessionVersion ?? 0,
    });

    if (!apiToken) {
      return NextResponse.json(
        { error: "Server configuration error: secret not found" },
        { status: 500 }
      );
    }

    return NextResponse.json({ token: apiToken });
  } catch (error) {
    console.error("Error getting token:", error);
    return NextResponse.json(
      { error: "Failed to get authentication token" },
      { status: 500 }
    );
  }
}
