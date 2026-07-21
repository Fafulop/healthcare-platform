import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireAnyAuth } from '@/lib/medical-auth';
import { handleApiError, AppError } from '@/lib/api-error-handler';

/** POST /api/team/my-invites/:id/decline */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { email } = await requireAnyAuth(request);
    const { id } = await params;

    const invite = await prisma.memberInvite.findUnique({ where: { id } });
    // Case-insensitive compare (ultra finding — see accept/route.ts).
    if (!invite || invite.email.toLowerCase() !== email.toLowerCase()) {
      throw new AppError('Invitación no encontrada', 404);
    }
    if (invite.status !== 'PENDING') {
      return NextResponse.json({ success: true, data: invite }); // idempotent
    }

    // Atomic conditional update (ultra finding — lost-update race): findUnique
    // above takes no lock, so a concurrent accept/decline/expire could commit
    // in the gap between the read and this write. Guarding status:'PENDING'
    // in the WHERE re-checks the CURRENT row at execute time — count===0
    // means someone else already responded, handled as idempotent below.
    const { count } = await prisma.memberInvite.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'DECLINED', respondedAt: new Date() },
    });
    const result = count > 0
      ? await prisma.memberInvite.findUnique({ where: { id } })
      : invite; // lost the race — already responded, return prior state (idempotent)

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleApiError(error, 'POST /api/team/my-invites/[id]/decline');
  }
}
