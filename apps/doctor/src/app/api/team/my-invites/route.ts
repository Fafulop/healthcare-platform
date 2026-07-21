import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireAnyAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';

/** GET /api/team/my-invites — pending invites for MY email, regardless of
 * whether I already belong to (or own) a portal. Deliberately uses
 * requireAnyAuth (not requireDoctorAuth) — this is the one screen a fully
 * unlinked user (no doctorId at all) must be able to reach. */
export async function GET(request: NextRequest) {
  try {
    const { email } = await requireAnyAuth(request);

    await prisma.memberInvite.updateMany({
      where: { email, status: 'PENDING', expiresAt: { lt: new Date() } },
      data: { status: 'EXPIRED' },
    });

    const invites = await prisma.memberInvite.findMany({
      where: { email, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: { doctor: { select: { doctorFullName: true, lastName: true, primarySpecialty: true } } },
    });

    return NextResponse.json({ success: true, data: invites });
  } catch (error) {
    return handleApiError(error, 'GET /api/team/my-invites');
  }
}
