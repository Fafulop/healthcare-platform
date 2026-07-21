import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireOwnerAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';

/** DELETE /api/team/invites/:id — revoke a pending invite before it's accepted. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctorId } = await requireOwnerAuth(request);
    const { id } = await params;

    const invite = await prisma.memberInvite.findFirst({ where: { id, doctorId } });
    if (!invite) {
      return NextResponse.json({ error: 'Invitación no encontrada' }, { status: 404 });
    }
    if (invite.status !== 'PENDING') {
      return NextResponse.json({ success: true, data: invite }); // idempotent
    }

    // Atomic conditional update (ultra finding — lost-update race): without
    // the status:'PENDING' guard here, an accept that commits between the
    // findFirst above and this write would get silently overwritten back to
    // REVOKED while the member's ACTIVE row stays intact — no security hole,
    // but the invite audit trail would lie about what happened.
    const { count } = await prisma.memberInvite.updateMany({
      where: { id, doctorId, status: 'PENDING' },
      data: { status: 'REVOKED', respondedAt: new Date() },
    });
    const result = count > 0
      ? await prisma.memberInvite.findUnique({ where: { id } })
      : invite; // lost the race — already responded, return prior state (idempotent)

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/team/invites/[id]');
  }
}
