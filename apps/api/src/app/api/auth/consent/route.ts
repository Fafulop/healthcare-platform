import { prisma } from "@healthcare/database";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { email },
      data: { privacyConsentAt: new Date() },
      select: {
        id: true,
        email: true,
        privacyConsentAt: true,
      },
    });

    return NextResponse.json({ success: true, privacyConsentAt: user.privacyConsentAt });
  } catch (error) {
    console.error("Error in /api/auth/consent:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
