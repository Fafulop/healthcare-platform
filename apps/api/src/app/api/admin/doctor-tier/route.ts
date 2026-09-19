// PATCH /api/admin/doctor-tier — admin-only write of Doctor.tier (product plan).
// TIERS T5. Design: docs/DESDE JUNIO/TIERS/01-DISENO-tecnico.md §7.
//
// This is the only HUMAN write path for the tier, deliberately separate from
// PUT /api/doctors/[slug] (which an owning DOCTOR may call for their own
// profile — a doctor must never be able to set their own plan).
//
// ⚠️ IT IS NO LONGER THE ONLY WRITE PATH, and this comment used to say it was.
// TIERS C2 moved the rules —canonical case, the quota guard, the audit row and
// idempotency— into `setDoctorTier()` in @healthcare/database, because C3's
// Stripe webhook has to move the tier too when a payment clears. Had the
// webhook written `doctor.update` directly it would have bypassed the quota
// guard that lived only inside this handler: two paths, different rules, same
// column — and it *looks* like it works. Every rule this handler used to own
// now lives in that helper; this route only authenticates, parses and
// translates the result to HTTP.
//
// The hard requirement of §7 survives inside the helper: a non-canonical value
// is REJECTED, never normalized. `tierAllows` is case-sensitive AND fail-open,
// so a stored 'free' would not match TIER_EXCLUDED_KEYS and would silently
// disable gating — the account would behave as FALLBACK_TIER (PRO) while the
// UI said FREE.

import { NextResponse } from 'next/server';
import { prisma, TIER_EXCLUDED_KEYS, setDoctorTier } from '@healthcare/database';
import { stripeCobro } from '@/lib/stripe-cobro';
import { filaDeCobroVigente } from '@/lib/cobro-planes';
import { requireAdminAuth, AuthError } from '@/lib/auth';

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
    // 04-PLAN §0: el 2026-09-17 se bajó a mano un plan que estaba pagado hasta
    // el 17 de octubre, y la cuenta perdió el mes. El modal del admin no tenía
    // forma de saberlo: `doctors` no dice nada del dinero. Se manda junto lo
    // mínimo para poder AVISAR antes de guardar — nunca para decidir el tier,
    // que sigue saliendo de `Doctor.tier`.
    const [doctors, suscripciones, precios] = await Promise.all([
      prisma.doctor.findMany({
        select: { id: true, slug: true, tier: true },
        orderBy: { slug: 'asc' },
      }),
      prisma.subscription.findMany({
        select: {
          doctorId: true,
          status: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          stripePriceId: true,
        },
      }),
      // 04 §12 R7: el modal dice QUÉ plan le cobra Stripe, para que subirlo o
      // bajarlo a mano no deje dos planes distintos sin que nadie lo vea. SIN
      // filtrar por `activo`, igual que el webhook: quien se suscribió con un
      // precio que luego se reemplazó sigue pagando ESE plan.
      prisma.tierPrice.findMany({ select: { stripePriceId: true, tier: true } }),
    ]);
    const tierDePrecio = new Map(precios.map((p) => [p.stripePriceId, p.tier]));

    // 🔴 Una fila de OTRO modo de Stripe no puede afirmar que alguien pagó.
    // «Pasar a vivo» es cambiar la clave, pero las filas de MODO PRUEBA se
    // quedan en la BD con su `active` y su fecha futura — y sin esto el modal
    // pintaría «pagó hasta el X, no hay reembolsos» sobre dinero que nunca
    // existió. `filaDeCobroVigente` es la misma función que ya resuelve esto en
    // el checkout y en el estado del doctor (review de C3, #2); se llama sólo
    // para los doctores que TIENEN fila, que son un puñado.
    //
    // Si Stripe falla, la fila se CONSERVA: el aviso es una advertencia, y
    // equivocarse mostrándola de más es ruido, mientras que esconderla es
    // exactamente el error del 2026-09-17. Fail-open hacia avisar.
    const cliente = stripeCobro();
    const vigentes = new Map(suscripciones.map((s) => [s.doctorId, s]));
    if (cliente) {
      await Promise.all(
        suscripciones.map(async (s) => {
          try {
            const { fila } = await filaDeCobroVigente(prisma, cliente, s.doctorId);
            if (!fila) vigentes.delete(s.doctorId);
          } catch (e) {
            console.warn('[COBRO] no se pudo verificar el modo de la suscripción', s.doctorId, e);
          }
        }),
      );
    }

    const porDoctor = new Map(vigentes);
    const data = doctors.map((d) => {
      const s = porDoctor.get(d.id);
      return {
        ...d,
        // `null` ⇒ no hay fila de cobro (cortesía puesta a mano, o nunca pagó).
        // Es un caso distinto de "pagó y ya venció", y el modal los separa.
        cobro: s
          ? {
              status: s.status,
              pagadoHasta: s.currentPeriodEnd,
              cancelaAlFinal: s.cancelAtPeriodEnd,
              // `null` ⇒ el precio no está en el mapa (o no hay precio): el modal
              // lo dice así en vez de inventar un plan.
              planPagado: (s.stripePriceId && tierDePrecio.get(s.stripePriceId)) || null,
            }
          : null,
      };
    });

    return NextResponse.json({ success: true, data });
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

    // TIERS C2 — TODAS las reglas (case canónico, guard de cupo, bitácora e
    // idempotencia) viven ahora en `setDoctorTier`, que comparten esta ruta y
    // el webhook de C3. Esta ruta ya sólo autentica, parsea y traduce a HTTP.
    const resultado = await setDoctorTier({
      db: prisma,
      doctorId,
      tier,
      origen: 'admin',
      actor: admin.email,
      motivo: typeof body?.motivo === 'string' ? body.motivo : null,
    });

    if (!resultado.ok) {
      const status =
        resultado.code === 'INVALID_TIER' ? 400 : resultado.code === 'NOT_FOUND' ? 404 : 409;
      return NextResponse.json(
        {
          success: false,
          error: resultado.code === 'INVALID_TIER' ? 'Invalid tier' : resultado.code,
          message: resultado.mensaje,
          // El modal del admin lee `message`; los números van aparte para quien
          // quiera pintarlos (Q3 los devolvía así y se conserva la forma).
          ...(resultado.code === 'QUOTA_EXCEEDED'
            ? { data: { current: resultado.current, limit: resultado.limit, tier: resultado.tier } }
            : {}),
        },
        { status }
      );
    }

    if (resultado.changed) {
      // TIERS 04 §12.6 #6.2: un cambio de plan a mano del admin DESCONGELA la
      // cuenta. Sólo DURA si el plan es LAB (cortesía; el cron no lo revisa) o
      // GRATIS: a otro plan de pago, `pagado_hasta` sigue vencido y el cron la
      // vuelve a congelar al día siguiente (igual que #6.1 revierte un plan
      // puesto a mano sin pago). A propósito: la salida de un caso especial es LAB.
      await prisma.doctor.updateMany({
        where: { id: doctorId, congeladaDesde: { not: null } },
        data: { congeladaDesde: null },
      });

      // El rastro DURADERO ya quedó en tier_change_log; esto sólo ayuda a
      // seguirlo en los logs del deploy en caliente.
      console.log('[TIERS] tier changed', {
        admin: admin.email,
        doctorId,
        from: resultado.from,
        to: resultado.to,
        excludes: TIER_EXCLUDED_KEYS[resultado.to],
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        doctorId,
        previousTier: resultado.from,
        tier: resultado.to,
        changed: resultado.changed,
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
