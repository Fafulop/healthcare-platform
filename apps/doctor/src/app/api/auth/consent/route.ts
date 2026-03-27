import { prisma } from "@healthcare/database";
import { auth } from "@healthcare/auth";
import { NextResponse } from "next/server";

// Records the doctor's acceptance of the privacy policy.
// Email is taken from the authenticated session — never from the request body.
export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.update({
      where: { email: session.user.email },
      data: { privacyConsentAt: new Date() },
      select: { privacyConsentAt: true },
    });

    return NextResponse.json({ success: true, privacyConsentAt: user.privacyConsentAt });
  } catch (error) {
    console.error("Error in /api/auth/consent:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
