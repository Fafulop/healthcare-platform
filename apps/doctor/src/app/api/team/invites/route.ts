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

    // (G2, 03-PLAN §3.1) Lazy-expire this doctor's stale PENDING invites BEFORE
    // evaluating the slot — otherwise an expired-but-still-PENDING invite would
    // falsely occupy the slot forever. Same sweep the GET already does.
    await prisma.memberInvite.updateMany({
      where: { doctorId, status: 'PENDING', expiresAt: { lt: new Date() } },
      data: { status: 'EXPIRED' },
    });

    // "1 slot" rule (03-PLAN §3.1): a doctor may have at most ONE helper — one
    // ACTIVE member OR one PENDING invite occupies the single slot. Backstopped
    // in the DB by doctor_members_one_active_member_per_doctor +
    // member_invites_one_pending_per_doctor (the catch below maps their P2002s).
    const activeMember = await prisma.doctorMember.findFirst({
      where: { doctorId, role: 'MEMBER', status: 'ACTIVE' },
    });
    if (activeMember) {
      return NextResponse.json({ error: 'Ya tienes un asistente vinculado; revócalo antes de invitar a otro' }, { status: 409 });
    }
    const pendingInvite = await prisma.memberInvite.findFirst({
      where: { doctorId, status: 'PENDING' },
    });
    if (pendingInvite) {
      return NextResponse.json({ error: 'Ya tienes una invitación pendiente; cancélala antes de invitar a otro' }, { status: 409 });
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
        // After the "1 slot" pre-checks above, any P2002 on create is a concurrent
        // invite that won the race. Both possible indexes (one_pending on
        // doctor+email, one_pending_per_doctor on doctor_id) mean the same thing to
        // the owner: a pending invite now exists. One accurate message — no fragile
        // meta.target branching (meta.target is column names, not the index name).
        return NextResponse.json(
          { error: 'Ya tienes una invitación pendiente; cancélala antes de invitar a otro' },
          { status: 409 }
        );
      }
      throw e;
    }
  } catch (error) {
    return handleApiError(error, 'POST /api/team/invites');
  }
}
