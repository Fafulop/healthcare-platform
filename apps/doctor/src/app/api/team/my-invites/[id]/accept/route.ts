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
    const emailNorm = email.toLowerCase();

    // Lazy-expire BEFORE opening the transaction — a write followed by a
    // throw inside prisma.$transaction rolls the whole thing back, so doing
    // this INSIDE the tx (the original code) silently discarded the EXPIRED
    // write every time (ultra review finding, 2026-07-21). Mirrors the same
    // sweep GET /api/team/(my-)invites already does.
    await prisma.memberInvite.updateMany({
      where: { id, status: 'PENDING', expiresAt: { lt: new Date() } },
      data: { status: 'EXPIRED' },
    });

    const membership = await prisma.$transaction(async (tx) => {
      const invite = await tx.memberInvite.findUnique({ where: { id } });
      // Case-insensitive: invite.email is normalized at creation
      // (invites/route.ts), but session emails from Google OAuth are stored
      // verbatim — Workspace domains can preserve mixed case (ultra finding).
      if (!invite || invite.email.toLowerCase() !== emailNorm) {
        throw new AppError('Invitación no encontrada', 404);
      }
      if (invite.status === 'EXPIRED' || (invite.status === 'PENDING' && invite.expiresAt < new Date())) {
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

      // (03-PLAN §3.2) 1-helper rule: the target doctor must not already have an
      // active member. Backstopped atomically by
      // doctor_members_one_active_member_per_doctor (P2002 → mapped in catch).
      const doctorHasMember = await tx.doctorMember.findFirst({
        where: { doctorId: invite.doctorId, role: 'MEMBER', status: 'ACTIVE' },
      });
      if (doctorHasMember) {
        throw new AppError('Este consultorio ya tiene un asistente', 409);
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
      // Same class of race as ultra's revoke/decline finding, symmetric: the
      // initial read (line 33) took no lock, so an owner revoke could commit
      // during THIS transaction's execution. An unconditional update here
      // would silently overwrite that revoke back to ACCEPTED and let the
      // membership just created above stand. Guarding status:'PENDING' and
      // throwing on count===0 rolls back the WHOLE transaction — including
      // the doctorMember create — so a mid-flight revoke wins cleanly.
      const { count } = await tx.memberInvite.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });
      if (count === 0) {
        throw new AppError('La invitación cambió mientras se procesaba, intenta de nuevo', 409);
      }
      return created;
    });

    return NextResponse.json({ success: true, data: membership });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      // (G1, 03-PLAN §4) Two doctor_members indexes fire P2002 here, distinguished
      // by COLUMN (Prisma meta.target = column names, verified empirically = ["doctor_id"];
      // matches the booking_id/sale_number precedent in this repo): the per-doctor
      // member index is on doctor_id ("this doctor already has a helper"); the
      // one_active_per_user index is on user_id ("your account is already linked").
      const target = String(error.meta?.target ?? '');
      const msg = target.includes('doctor_id')
        ? 'Este consultorio ya tiene un asistente'
        : 'Tu cuenta ya fue vinculada a un consultorio';
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return handleApiError(error, 'POST /api/team/my-invites/[id]/accept');
  }
}
