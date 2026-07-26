// PATCH /api/admin/doctor-tier — admin-only write of Doctor.tier (product plan).
// TIERS T5. Design: docs/DESDE JUNIO/TIERS/01-DISENO-tecnico.md §7.
//
// This is the ONLY write path for the tier, deliberately separate from
// PUT /api/doctors/[slug] (which an owning DOCTOR may call for their own
// profile — a doctor must never be able to set their own plan).
//
// ⚠️ HARD REQUIREMENT (§7): the value is validated against DOCTOR_TIERS with the
// CANONICAL case. `tierAllows` is case-sensitive AND fail-open, so a stored
// 'core' would not match TIER_EXCLUDED_KEYS and would silently disable gating —
// the account would behave as FULL while the UI said CORE. That is the worst
// failure mode of this feature because it *looks* like it worked. Non-canonical
// values are REJECTED (not normalized) so the mistake is loud at the boundary.

import { NextResponse } from 'next/server';
import { prisma, DOCTOR_TIERS, TIER_EXCLUDED_KEYS, type DoctorTier } from '@healthcare/database';
import { requireAdminAuth, AuthError } from '@/lib/auth';

function isCanonicalTier(value: unknown): value is DoctorTier {
  return typeof value === 'string' && (DOCTOR_TIERS as readonly string[]).includes(value);
}

// GET — tiers for every doctor. Admin-only on purpose: the tier is deliberately
// NOT part of the public GET /api/doctors payload (doctor-public-fields.ts), so
// the admin UI reads it here instead. Same shape of split the /helpers page uses.
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
      { status: error instanceof AuthError ? error.status : 401 }
    );
  }

  try {
    const doctors = await prisma.doctor.findMany({
      select: { id: true, slug: true, tier: true },
      orderBy: { slug: 'asc' },
    });
    return NextResponse.json({ success: true, data: doctors });
  } catch (error) {
    console.error('GET /api/admin/doctor-tier failed:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', message: 'No se pudieron cargar los planes' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  let admin: { email: string };
  try {
    admin = await requireAdminAuth(request);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized',
        message: error instanceof Error ? error.message : 'Admin access required',
      },
      { status: error instanceof AuthError ? error.status : 401 }
    );
  }

  try {
    const body = await request.json().catch(() => null);
    const doctorId = body?.doctorId;
    const tier = body?.tier;

    if (typeof doctorId !== 'string' || !doctorId) {
      return NextResponse.json(
        { success: false, error: 'Bad request', message: 'doctorId es requerido' },
        { status: 400 }
      );
    }

    // Canonical-case check — see the header note. No toUpperCase() on purpose.
    if (!isCanonicalTier(tier)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid tier',
          message:
            `Tier inválido: ${JSON.stringify(tier)}. ` +
            `Valores permitidos (case-sensitive): ${DOCTOR_TIERS.join(', ')}.`,
        },
        { status: 400 }
      );
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { id: true, slug: true, doctorFullName: true, tier: true },
    });

    if (!doctor) {
      return NextResponse.json(
        { success: false, error: 'Not found', message: `No existe el doctor ${doctorId}` },
        { status: 404 }
      );
    }

    if (doctor.tier === tier) {
      // Idempotent: nothing to write, still report the current state.
      return NextResponse.json({
        success: true,
        data: { doctorId: doctor.id, slug: doctor.slug, previousTier: doctor.tier, tier, changed: false },
      });
    }

    const updated = await prisma.doctor.update({
      where: { id: doctorId },
      data: { tier },
      select: { id: true, slug: true, tier: true },
    });

    // Traceability: tier changes are rare, manual, and change what a whole
    // account can do. member_audit_log covers member writes only, so the log is
    // the record here.
    console.log('[TIERS] tier changed', {
      admin: admin.email,
      doctorId: updated.id,
      slug: updated.slug,
      from: doctor.tier,
      to: updated.tier,
      excludes: TIER_EXCLUDED_KEYS[tier],
    });

    return NextResponse.json({
      success: true,
      data: {
        doctorId: updated.id,
        slug: updated.slug,
        previousTier: doctor.tier,
        tier: updated.tier,
        changed: true,
      },
    });
  } catch (error) {
    console.error('PATCH /api/admin/doctor-tier failed:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', message: 'No se pudo actualizar el plan' },
      { status: 500 }
    );
  }
}
