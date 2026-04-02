import { prisma } from "@healthcare/database";
import { auth } from "@healthcare/auth";
import { NextResponse } from "next/server";

// GET  /api/auth/sessions — list all non-expired sessions for current user
// DELETE /api/auth/sessions — delete all sessions (kill all devices)

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessions = await prisma.session.findMany({
      where: {
        userId: session.user.id,
        expires: { gt: new Date() },
      },
      select: {
        id: true,
        createdAt: true,
        expires: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const currentSessionId = (session as any).sessionId;

    const result = sessions.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      expires: s.expires,
      current: s.id === currentSessionId,
    }));

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Error in GET /api/auth/sessions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.session.deleteMany({
      where: { userId: session.user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/auth/sessions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
