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
    if (!invite || invite.email !== email) {
      throw new AppError('Invitación no encontrada', 404);
    }
    if (invite.status !== 'PENDING') {
      return NextResponse.json({ success: true, data: invite }); // idempotent
    }

    const declined = await prisma.memberInvite.update({
      where: { id },
      data: { status: 'DECLINED', respondedAt: new Date() },
    });

    return NextResponse.json({ success: true, data: declined });
  } catch (error) {
    return handleApiError(error, 'POST /api/team/my-invites/[id]/decline');
  }
}
