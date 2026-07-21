import { NextRequest, NextResponse } from 'next/server';
import { prisma, Prisma, PERMISSION_KEYS } from '@healthcare/database';
import { requireOwnerAuth } from '@/lib/medical-auth';
import { handleApiError, ValidationError, validateEmail } from '@/lib/api-error-handler';

const INVITE_TTL_DAYS = 7;

function sanitizePermissions(input: unknown): Record<string, boolean> {
  if (input == null || typeof input !== 'object') {
    throw new ValidationError('permissions debe ser un objeto');
  }
  const out: Record<string, boolean> = {};
  for (const key of PERMISSION_KEYS) {
    const v = (input as Record<string, unknown>)[key];
    out[key] = v === true;
  }
  return out;
}

/** GET /api/team/invites — pending invites for this portal (lazy-expires stale ones). */
export async function GET(request: NextRequest) {
  try {
    const { doctorId } = await requireOwnerAuth(request);

    await prisma.memberInvite.updateMany({
      where: { doctorId, status: 'PENDING', expiresAt: { lt: new Date() } },
      data: { status: 'EXPIRED' },
    });

    const invites = await prisma.memberInvite.findMany({
      where: { doctorId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: invites });
  } catch (error) {
    return handleApiError(error, 'GET /api/team/invites');
  }
}

/** POST /api/team/invites — invite a gmail with a starting permission set.
 * The "does this email already own/belong to a portal" check happens at
 * ACCEPT time (01-DISENO §6.2) — a typo here is still just a pending row,
 * never access, per the explicit-accept requirement (00-REQUISITOS §2.1). */
export async function POST(request: NextRequest) {
  try {
    const { doctorId, userId } = await requireOwnerAuth(request);
    const body = await request.json();

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email) throw new ValidationError('email es requerido');
    validateEmail(email);

    const permissions = sanitizePermissions(body.permissions);

    // Case-insensitive (ultra finding): the invited email is normalized
    // lowercase, but users.email is stored verbatim from Google OAuth.
    const existingMember = await prisma.doctorMember.findFirst({
      where: { doctorId, status: 'ACTIVE', user: { email: { equals: email, mode: 'insensitive' } } },
    });
    if (existingMember) {
      return NextResponse.json({ error: 'Ese email ya es miembro activo de tu equipo' }, { status: 409 });
    }

    try {
      const invite = await prisma.memberInvite.create({
        data: {
          doctorId,
          email,
          permissions,
          invitedBy: userId,
          expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
        },
      });
      return NextResponse.json({ success: true, data: invite });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return NextResponse.json({ error: 'Ya hay una invitación pendiente para ese email' }, { status: 409 });
      }
      throw e;
    }
  } catch (error) {
    return handleApiError(error, 'POST /api/team/invites');
  }
}
