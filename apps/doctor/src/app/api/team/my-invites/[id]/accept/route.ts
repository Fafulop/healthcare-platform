import { NextRequest, NextResponse } from 'next/server';
import { prisma, Prisma } from '@healthcare/database';
import { requireAnyAuth } from '@/lib/medical-auth';
import { handleApiError, AppError } from '@/lib/api-error-handler';

/**
 * POST /api/team/my-invites/:id/accept — G1 (explicit accept, never
 * auto-attach) + v1 one-portal rule, both re-checked HERE (not just at
 * invite-creation time) per 01-DISENO §6.2. Race backstop:
 * doctor_members_one_active_per_user (partial unique index) turns a
 * simultaneous double-accept into a 409 instead of two ACTIVE memberships.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, email, doctorId: myDoctorId } = await requireAnyAuth(request);
    const { id } = await params;

    const membership = await prisma.$transaction(async (tx) => {
      const invite = await tx.memberInvite.findUnique({ where: { id } });
      if (!invite || invite.email !== email) {
        throw new AppError('Invitación no encontrada', 404);
      }
      if (invite.status === 'PENDING' && invite.expiresAt < new Date()) {
        await tx.memberInvite.update({ where: { id }, data: { status: 'EXPIRED' } });
        throw new AppError('La invitación expiró', 410);
      }
      if (invite.status !== 'PENDING') {
        throw new AppError('Esa invitación ya no está disponible', 409);
      }

      // v1 one-portal rule (00-REQUISITOS §1.1 / §2.2): a doctor who already
      // owns a portal (legacy doctorId) cannot also become a member of another.
      if (myDoctorId) {
        throw new AppError('Tu cuenta ya está vinculada a un consultorio', 409);
      }
      const existingActive = await tx.doctorMember.findFirst({
        where: { userId, status: 'ACTIVE' },
      });
      if (existingActive) {
        throw new AppError('Tu cuenta ya pertenece a otro consultorio', 409);
      }

      const created = await tx.doctorMember.create({
        data: {
          userId,
          doctorId: invite.doctorId,
          role: 'MEMBER',
          status: 'ACTIVE',
          permissions: invite.permissions ?? {},
          invitedBy: invite.invitedBy,
        },
      });
      await tx.memberInvite.update({
        where: { id },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });
      return created;
    });

    return NextResponse.json({ success: true, data: membership });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Tu cuenta ya fue vinculada a un consultorio' },
        { status: 409 }
      );
    }
    return handleApiError(error, 'POST /api/team/my-invites/[id]/accept');
  }
}
