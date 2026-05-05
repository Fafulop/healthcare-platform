import { prisma } from "@healthcare/database";
import { NextResponse } from "next/server";
import { validateAuthToken, AuthError } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await validateAuthToken(request);

    await prisma.user.update({
      where: { email: user.email },
      data: { privacyConsentAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error in /api/auth/consent:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
