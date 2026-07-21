import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireOwnerAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';

/** GET /api/team/members — list this portal's members (ACTIVE + REVOKED, for history). */
export async function GET(request: NextRequest) {
  try {
    const { doctorId } = await requireOwnerAuth(request);

    const members = await prisma.doctorMember.findMany({
      where: { doctorId, role: 'MEMBER' },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, email: true, name: true, image: true } } },
    });

    return NextResponse.json({ success: true, data: members });
  } catch (error) {
    return handleApiError(error, 'GET /api/team/members');
  }
}
