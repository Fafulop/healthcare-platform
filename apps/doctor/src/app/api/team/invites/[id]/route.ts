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

    const revoked = await prisma.memberInvite.update({
      where: { id },
      data: { status: 'REVOKED', respondedAt: new Date() },
    });

    return NextResponse.json({ success: true, data: revoked });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/team/invites/[id]');
  }
}
