import { NextRequest, NextResponse } from 'next/server';
import { prisma, PERMISSION_KEYS } from '@healthcare/database';
import { requireOwnerAuth } from '@/lib/medical-auth';
import { handleApiError, ValidationError } from '@/lib/api-error-handler';

function sanitizePermissions(input: unknown): Record<string, boolean> {
  if (input == null || typeof input !== 'object') {
    throw new ValidationError('permissions debe ser un objeto');
  }
  const out: Record<string, boolean> = {};
  for (const key of PERMISSION_KEYS) {
    const v = (input as Record<string, unknown>)[key];
    out[key] = v === true; // fail-closed: anything not literally true is false
  }
  return out;
}

/** PATCH /api/team/members/:id — edit a member's permission toggles.
 * Takes effect on the member's NEXT request (session()/validateAuthToken
 * re-resolve permissions per-request — no re-login needed). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctorId } = await requireOwnerAuth(request);
    const { id } = await params;
    const body = await request.json();

    const member = await prisma.doctorMember.findFirst({ where: { id, doctorId } });
    if (!member) {
      return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 });
    }
    if (member.role === 'OWNER') {
      return NextResponse.json({ error: 'No se pueden editar los permisos del dueño' }, { status: 400 });
    }

    const permissions = sanitizePermissions(body.permissions);
    const updated = await prisma.doctorMember.update({
      where: { id },
      data: { permissions },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return handleApiError(error, 'PATCH /api/team/members/[id]');
  }
}

/** DELETE /api/team/members/:id — revoke (status REVOKED, never deletes the
 * row — frees the v1 one-portal slot, keeps history, 00-REQUISITOS §2.3). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctorId } = await requireOwnerAuth(request);
    const { id } = await params;

    const member = await prisma.doctorMember.findFirst({ where: { id, doctorId } });
    if (!member) {
      return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 });
    }
    if (member.role === 'OWNER') {
      // Owner self-revocation is out of scope for v1 (00-REQUISITOS §7) —
      // reject explicitly rather than silently locking the doctor out.
      return NextResponse.json({ error: 'El dueño no puede revocarse a sí mismo' }, { status: 400 });
    }
    if (member.status === 'REVOKED') {
      return NextResponse.json({ success: true, data: member }); // already revoked, idempotent
    }

    // Atomic conditional update (same class of lost-update race flagged by
    // ultra review on the invite-revoke endpoints) — cheap consistency fix.
    const { count } = await prisma.doctorMember.updateMany({
      where: { id, doctorId, status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
    const result = count > 0
      ? await prisma.doctorMember.findUnique({ where: { id } })
      : member;

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/team/members/[id]');
  }
}
