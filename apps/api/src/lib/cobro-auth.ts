/**
 * La puerta común de las rutas de cobro del DOCTOR (TIERS C3): estado,
 * checkout y portal. Las tres exigen exactamente lo mismo, así que se escribe
 * una vez.
 *
 * Devuelve el contexto o una respuesta HTTP ya armada — nunca deja pasar a
 * medias.
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedDoctorStripe, AuthError } from '@/lib/auth';
import { doctorPuedeUsarCobro } from '@/lib/stripe-cobro';

export interface ContextoCobro {
  email: string;
  doctorId: string;
  slug: string;
  nombre: string;
  tier: string;
}

export async function puertaDeCobro(
  request: Request,
): Promise<{ ok: true; ctx: ContextoCobro } | { ok: false; respuesta: NextResponse }> {
  let user;
  let doctor;
  try {
    ({ user, doctor } = await getAuthenticatedDoctorStripe(request));
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 401;
    return {
      ok: false,
      respuesta: NextResponse.json({ error: e instanceof Error ? e.message : 'No autorizado' }, { status }),
    };
  }

  // El route map ya bloquea a los members (`billing` es OWNER_ONLY), pero el
  // cobro es dinero: se comprueba otra vez aquí, en la ruta que lo mueve.
  if (!user.isOwner) {
    return {
      ok: false,
      respuesta: NextResponse.json({ error: 'Sólo el titular de la cuenta maneja el cobro' }, { status: 403 }),
    };
  }

  return {
    ok: true,
    ctx: {
      email: user.email,
      doctorId: doctor.id,
      slug: doctor.slug,
      nombre: doctor.doctorFullName,
      tier: user.tier,
    },
  };
}

/** 404 deliberado: fuera de la lista de prueba, el cobro "no existe" para ese doctor. */
export function cobroNoDisponible(): NextResponse {
  return NextResponse.json({ error: 'El cobro no está disponible para esta cuenta' }, { status: 404 });
}

export { doctorPuedeUsarCobro };
