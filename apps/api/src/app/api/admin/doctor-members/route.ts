// GET /api/admin/doctor-members — admin-only directory of helper (MEMBER)
// accounts per doctor. Reads doctor_members (NOT users.doctor_id, which only
// links OWNERS — members have doctorId=null and are invisible on /users).
// Design: docs/DESDE JUNIO/NUEVOS USUARIOS/04-PLAN-vista-admin-helpers.md

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireAdminAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    await requireAdminAuth(request);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized',
        message: error instanceof Error ? error.message : 'Admin access required',
      },
      { status: 401 }
    );
  }

  try {
    // Active helpers, joined to their user + doctor (never via users.doctor_id).
    const members = await prisma.doctorMember.findMany({
      where: { role: 'MEMBER', status: 'ACTIVE' },
      include: {
        user: { select: { id: true, email: true, name: true, image: true } },
        doctor: { select: { id: true, slug: true, doctorFullName: true, primarySpecialty: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Pending, non-expired invites (read-only filter — no lazy-expire write here).
    const pending = await prisma.memberInvite.findMany({
      where: { status: 'PENDING', expiresAt: { gte: new Date() } },
      include: { doctor: { select: { id: true, slug: true, doctorFullName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Resolve the inviting owner's email (invitedBy is a user_id, not a relation).
    const inviterIds = [...new Set(members.map((m) => m.invitedBy).filter((x): x is string => !!x))];
    const inviters = inviterIds.length
      ? await prisma.user.findMany({ where: { id: { in: inviterIds } }, select: { id: true, email: true } })
      : [];
    const inviterEmail: Record<string, string> = Object.fromEntries(inviters.map((u) => [u.id, u.email]));

    return NextResponse.json({
      success: true,
      data: {
        members: members.map((m) => ({
          id: m.id,
          doctorId: m.doctorId,
          doctorName: m.doctor.doctorFullName,
          doctorSlug: m.doctor.slug,
          memberEmail: m.user.email,
          memberName: m.user.name,
          memberImage: m.user.image,
          permissions: m.permissions,
          invitedByEmail: m.invitedBy ? inviterEmail[m.invitedBy] ?? null : null,
          createdAt: m.createdAt,
        })),
        pending: pending.map((inv) => ({
          id: inv.id,
          doctorId: inv.doctorId,
          doctorName: inv.doctor.doctorFullName,
          email: inv.email,
          permissions: inv.permissions,
          createdAt: inv.createdAt,
          expiresAt: inv.expiresAt,
        })),
      },
    });
  } catch (error) {
    console.error('GET /api/admin/doctor-members failed:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', message: 'No se pudieron cargar los asistentes' },
      { status: 500 }
    );
  }
}
