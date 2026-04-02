import { prisma } from "@healthcare/database";
import { auth } from "@healthcare/auth";
import { NextResponse } from "next/server";

// DELETE /api/auth/sessions/[id] — revoke one specific session
// Verifies the session belongs to the authenticated user before deleting.

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify the session belongs to this user before deleting
    const target = await prisma.session.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!target) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (target.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.session.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/auth/sessions/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
