/**
 * PATCH /api/admin/cambios-de-plan — cerrar una solicitud de bajar de plan.
 * Admin-only. TIERS 04 §12.6 #7 (versión corta).
 *
 * 🔴 ESTO NO CAMBIA EL PLAN DE NADIE. Sólo marca la solicitud como atendida.
 * El cambio lo hace el admin a mano, y son DOS pasos, no uno:
 *
 *   1. Cambiar la SUSCRIPCIÓN EN STRIPE al precio del plan nuevo.
 *   2. Cambiar el plan del doctor en el modal de «Doctores».
 *
 * Hacer sólo el paso 2 deja al doctor con el plan menor mientras Stripe le
 * sigue cobrando el mayor: se le cobra de más por menos. Al revés (sólo el 1)
 * le cobra el plan nuevo mientras sigue usando el viejo, y la renovación NO lo
 * corrige, porque un pago nunca baja un plan. `apps/admin/src/lib/aviso-cobro.ts`
 * lo explica con el caso real del 2026-09-17, donde una cuenta perdió un mes ya
 * pagado.
 *
 * Por eso el botón dice «Marcar como hecha» y no «Aplicar»: lo que se registra
 * aquí es que un humano YA lo hizo, no una orden para que pase.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireAdminAuth, AuthError } from '@/lib/auth';

const ESTADOS_FINALES = ['HECHA', 'RECHAZADA'] as const;
type EstadoFinal = (typeof ESTADOS_FINALES)[number];

export async function PATCH(request: Request) {
  let admin: Awaited<ReturnType<typeof requireAdminAuth>>;
  try {
    admin = await requireAdminAuth(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: error instanceof AuthError ? error.status : 401 },
    );
  }

  try {
    const body = (await request.json()) as { id?: string; estado?: string; nota?: string };
    const { id, estado, nota } = body;

    if (!id || !estado || !(ESTADOS_FINALES as readonly string[]).includes(estado)) {
      return NextResponse.json(
        { success: false, message: 'Falta `id` o `estado` (HECHA | RECHAZADA)' },
        { status: 400 },
      );
    }

    // `updateMany` con el estado en el WHERE: si otro admin ya la cerró, esto
    // devuelve 0 en vez de pisarle su resolución y su nota.
    const { count } = await prisma.solicitudCambioPlan.updateMany({
      where: { id, estado: 'PENDIENTE' },
      data: {
        estado: estado as EstadoFinal,
        resueltaEn: new Date(),
        resueltaPor: admin.email,
        notaAdmin: nota?.slice(0, 400) ?? null,
      },
    });

    if (count === 0) {
      return NextResponse.json(
        { success: false, message: 'Esa solicitud ya no estaba pendiente.' },
        { status: 409 },
      );
    }

    console.log('[CAMBIO-PLAN] resuelta', { id, estado, por: admin.email });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[CAMBIO-PLAN] error al resolver', error);
    return NextResponse.json(
      { success: false, message: 'No se pudo actualizar la solicitud' },
      { status: 500 },
    );
  }
}
